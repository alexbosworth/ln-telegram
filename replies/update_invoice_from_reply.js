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
const {isArray} = Array;
const {isSafeInteger} = Number;
const maxDescriptionBytes = 639;
const maxTokens = 1e13;
const split = n => n.split('\n');

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
      deleteQuestion: ['type', async ({type}) => {
        if (!type) {
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
        'details',
        'node',
        'updated',
        asyncReflect(({details, node, updated}, cbk) =>
      {
        // Exit early when there is no update to make
        if (!updated) {
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
        'details',
        'updated',
        ({cancel, details, updated}, cbk) =>
      {
        // Exit early when there is no update or the original was not canceled
        if (!updated || !!cancel.error) {
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
        'getInvoice',
        'getTokens',
        async ({cancel, checkDescription, getInvoice, getTokens}) =>
      {
        // Exit early when there is no failure
        if (!cancel.error && !checkDescription.error && !getTokens.error) {
          return;
        }

        const error = checkDescription.error || getTokens.error ||
          cancel.error;

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
        'getInvoice',
        'getTokens',
        'node',
        'postFailure',
        async ({cancel, checkDescription, getInvoice, getTokens, node}) =>
      {
        // Exit early when there was no failure
        if (!cancel.error && !checkDescription.error && !getTokens.error) {
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
    returnResult({reject, resolve}, cbk));
  });
};
