const asyncAuto = require('async/auto');
const asyncReflect = require('async/reflect');
const {cancelHodlInvoice} = require('ln-service');
const {getInvoice} = require('ln-service');
const {parsePaymentRequest} = require('ln-service');
const {returnResult} = require('asyncjs-util');

const {callbackCommands} = require('./../interface');
const {checkAccess} = require('./../authentication');
const {createInvoiceMessage} = require('./../messages');
const {failureMessage} = require('./../messages');
const {getAmountAsTokens} = require('./../interface');
const invoiceActionType = require('./invoice_action_type');
const {postCreatedInvoice} = require('./../post');

const byteLength = text => Buffer.byteLength(text, 'utf8');
const grpcDetails = ([,, res]) => !!res && !!res.err && res.err.details;
const {isArray} = Array;
const isKeepingQuestion = ([code]) => [409, 503].includes(code);
const isMissing = n => /unable to locate invoice|no existing invoices/.test(n);
const {isSafeInteger} = Number;
const maxDescriptionBytes = 639;
const maxTokens = 1e13;
const split = n => n.split('\n');
const updating = new Set();

/** Update the details of a created invoice from reply input

  {
    api: <Bot API Object>
    ctx: <Telegram Context Object>
    id: <Connected User Id Number>
    nodes: [{
      from: <Saved Node Name String>
      lnd: <Authenticated LND API Object>
      public_key: <Node Identity Public Key Hex String>
    }]
    request: <Request Function>
  }

  @returns via cbk or Promise
*/
module.exports = ({api, ctx, id, nodes, request}, cbk) => {
  return new Promise((resolve, reject) => {
    return asyncAuto({
      // Check arguments
      validate: cbk => {
        if (!api) {
          return cbk([400, 'ExpectedTelegramApiToUpdateInvoice']);
        }

        if (!ctx) {
          return cbk([400, 'ExpectedTelegramContextToUpdateInvoice']);
        }

        if (!id) {
          return cbk([400, 'ExpectedConnectedUserIdToUpdateInvoice']);
        }

        if (!isArray(nodes)) {
          return cbk([400, 'ExpectedArrayOfNodesToUpdateInvoice']);
        }

        if (!request) {
          return cbk([400, 'ExpectedRequestFunctionToUpdateInvoice']);
        }

        return cbk();
      },

      // Confirm access authorization
      checkAccess: ['validate', ({}, cbk) => {
        return checkAccess({id, from: ctx.message.from.id}, cbk);
      }],

      // Parse the referenced payment request
      details: ['checkAccess', ({}, cbk) => {
        // The payment request is the 2nd line
        const [, request] = split(ctx.update.message.reply_to_message.text);

        const details = parsePaymentRequest({request});

        return cbk(null, details);
      }],

      // Find the node that created the invoice
      node: ['details', ({details}, cbk) => {
        return cbk(
          null, nodes.find(n => n.public_key === details.destination)
        );
      }],

      // Determine what type of edit message this is
      type: ['checkAccess', ({}, cbk) => {
        const {text} = ctx.update.message.reply_to_message;

        const {type} = invoiceActionType({nodes, text});

        return cbk(null, type);
      }],

      // Delete the answer message the user just entered
      deleteAnswer: ['type', async ({type}) => {
        try {
          return !!type ? await ctx.deleteMessage() : null;
        } catch (err) {
          // Ignore errors when deleting
          return;
        }
      }],

      // Delete the edit message that had the question
      deleteQuestion: ['checkOpen', 'type', async ({checkOpen, type}) => {
        if (!type) {
          return;
        }

        // The question is kept when the invoice lookup failed, to try again,
        // and when another reply is updating the invoice, which may fail
        if (!!checkOpen.error && isKeepingQuestion(checkOpen.error)) {
          return;
        }

        try {
          await api.deleteMessage(
            ctx.update.message.reply_to_message.chat.id,
            ctx.update.message.reply_to_message.message_id,
          );
        } catch (err) {
          // Ignore errors when deleting
          return;
        }
      }],

      // Check the new description fits before the original is canceled
      checkDescription: ['type', asyncReflect(({type}, cbk) => {
        // Exit early when not updating the invoice description
        if (type !== callbackCommands.setInvoiceDescription) {
          return cbk();
        }

        const {text} = ctx.update.message;

        if (typeof text !== 'string') {
          return cbk([400, 'ExpectedTextToUpdateInvoiceDescription']);
        }

        // A payment request has room for a 639 byte description
        if (byteLength(text) > maxDescriptionBytes) {
          return cbk([400, 'ExpectedShorterDescriptionToUpdateInvoice']);
        }

        return cbk();
      })],

      // Only one reply at a time can update an invoice
      lock: ['details', 'type', ({details, type}, cbk) => {
        // Exit early when this is not an invoice update
        if (!type) {
          return cbk(null, {});
        }

        // Exit early when another reply is updating the invoice
        if (updating.has(details.id)) {
          return cbk(null, {is_busy: true});
        }

        updating.add(details.id);

        return cbk(null, {id: details.id});
      }],

      // Check that the invoice was not replaced by an earlier reply
      checkOpen: [
        'details',
        'lock',
        'node',
        'type',
        asyncReflect(({details, lock, node, type}, cbk) =>
      {
        // Exit early when this is not an invoice update
        if (!type) {
          return cbk();
        }

        if (!!lock.is_busy) {
          return cbk([409, 'InvoiceUpdateAlreadyInProgress']);
        }

        return getInvoice({id: details.id, lnd: node.lnd}, (err, res) => {
          // An invoice that is gone was canceled and then removed by LND
          if (!!err && isMissing(grpcDetails(err))) {
            return cbk([400, 'InvoiceWasAlreadyUpdatedOrCanceled']);
          }

          // Nothing is changed when the state of the invoice is unknown
          if (!!err) {
            return cbk([503, 'FailedToLookUpInvoiceToUpdate', {err}]);
          }

          if (!!res.is_canceled) {
            return cbk([400, 'InvoiceWasAlreadyUpdatedOrCanceled']);
          }

          return cbk();
        });
      })],

      // Get the amount as tokens for the invoice
      getTokens: ['details', 'type', asyncReflect(({details, type}, cbk) => {
        // Exit early when not updating the invoice amount
        if (type !== callbackCommands.setInvoiceTokens) {
          return cbk();
        }

        // Find the node that this invoice belongs to
        const node = nodes.find(n => n.public_key === details.destination);

        // Exit early when the invoicing node is unknown
        if (!node) {
          return cbk([400, 'InvoicingNodeNotFound']);
        }

        if (typeof ctx.update.message.text !== 'string') {
          return cbk([400, 'ExpectedTextToUpdateInvoiceAmount']);
        }

        return getAmountAsTokens({
          request,
          amount: ctx.update.message.text,
          lnd: node.lnd,
        },
        (err, res) => {
          if (!!err) {
            return cbk(err);
          }

          // LND caps invoices at 100k BTC; validate before canceling
          if (
            res.tokens < 0 ||
            res.tokens > maxTokens ||
            !isSafeInteger(res.tokens)
          ) {
            return cbk([400, 'ExpectedValidAmountToUpdateInvoice']);
          }

          return cbk(null, res);
        });
      })],

      // Details for the updated new invoice
      updated: [
        'checkDescription',
        'details',
        'getTokens',
        'type',
        ({checkDescription, details, getTokens, type}, cbk) =>
      {
        // Exit early when the type of update is not known
        if (!type) {
          return cbk();
        }

        const {description} = details;
        const {text} = ctx.update.message;
        const {tokens} = details;

        switch (type) {
        // Updating the invoice description
        case callbackCommands.setInvoiceDescription:
          // Exit early when the description is invalid
          if (!!checkDescription.error) {
            return cbk();
          }

          return cbk(null, {tokens, description: text});

        // Updating the invoice amount
        case callbackCommands.setInvoiceTokens:
          // Exit early when the amount could not be understood
          if (!getTokens.value) {
            return cbk();
          }

          return cbk(null, {description, tokens: getTokens.value.tokens});

        default:
          return cbk();
        }
      }],

      // Cancel the original invoice so that it can no longer be paid
      cancel: [
        'checkOpen',
        'details',
        'node',
        'updated',
        asyncReflect(({checkOpen, details, node, updated}, cbk) =>
      {
        // Exit early when there is no update to make
        if (!updated || !!checkOpen.error) {
          return cbk();
        }

        // An update means that the invoice is from one of the nodes
        return cancelHodlInvoice({id: details.id, lnd: node.lnd}, cbk);
      })],

      // Check if an invoice that could not be canceled was already paid
      getInvoice: [
        'cancel',
        'details',
        'node',
        asyncReflect(({cancel, details, node}, cbk) =>
      {
        // Exit early when the invoice was canceled
        if (!cancel.error) {
          return cbk();
        }

        return getInvoice({id: details.id, lnd: node.lnd}, cbk);
      })],

      // Post the invoice
      postInvoice: [
        'cancel',
        'checkOpen',
        'details',
        'updated',
        ({cancel, checkOpen, details, updated}, cbk) =>
      {
        // Exit early when there is no update or the original was not canceled
        if (!updated || !!cancel.error || !!checkOpen.error) {
          return cbk();
        }

        // Recreate the invoice with the updated details
        return postCreatedInvoice({
          ctx,
          nodes,
          description: updated.description,
          destination: details.destination,
          tokens: updated.tokens,
        },
        cbk);
      }],

      // Post a failure message if necessary
      postFailure: [
        'cancel',
        'checkDescription',
        'checkOpen',
        'getInvoice',
        'getTokens',
        async ({cancel, checkDescription, checkOpen, getInvoice, getTokens}) =>
      {
        const failed = checkOpen.error || checkDescription.error ||
          getTokens.error;

        const error = failed || cancel.error;

        // Exit early when there is no failure
        if (!error) {
          return;
        }

        const [, code] = error;
        const isPaid = !!getInvoice.value && getInvoice.value.is_confirmed;

        const failure = failureMessage({is_paid_invoice: isPaid});

        // A paid invoice gets an explanation instead of the error code
        const message = isPaid ? failure.message : code;

        try {
          await ctx.reply(message, failure.actions);
        } catch (err) {
          // Ignore errors
        }
      }],

      // Post the original invoice again when it was not replaced
      restoreInvoice: [
        'cancel',
        'checkDescription',
        'checkOpen',
        'getInvoice',
        'getTokens',
        'node',
        'postFailure',
        async ({
          cancel,
          checkDescription,
          checkOpen,
          getInvoice,
          getTokens,
          node,
        }) =>
      {
        const failed = cancel.error || checkDescription.error ||
          checkOpen.error || getTokens.error;

        // Exit early when there was no failure
        if (!failed) {
          return;
        }

        // Exit early when the invoice is not known to still be open
        if (!!checkOpen.error) {
          return;
        }

        // Exit early when the invoice was paid since it cannot be used again
        if (!!getInvoice.value && getInvoice.value.is_confirmed) {
          return;
        }

        const [, other] = nodes;
        const {text} = ctx.update.message.reply_to_message;

        const [, original] = split(text);

        // Make the message for the original invoice
        const message = createInvoiceMessage({
          from: !!other ? node.from : undefined,
          request: original,
        });

        try {
          await ctx.reply(message.text, {
            parse_mode: message.mode,
            reply_markup: message.markup,
          });
        } catch (err) {
          // Ignore errors
        }
      }],
    },
    (err, res) => {
      // The invoice can be updated again when this reply is finished
      if (!!res && !!res.lock && !!res.lock.id) {
        updating.delete(res.lock.id);
      }

      return returnResult({reject, resolve}, cbk)(err, res);
    });
  });
};
