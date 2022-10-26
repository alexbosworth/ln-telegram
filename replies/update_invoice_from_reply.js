const asyncAuto = require('async/auto');
const asyncReflect = require('async/reflect');
const {createInvoice} = require('ln-service');
const {parsePaymentRequest} = require('ln-service');
const {returnResult} = require('asyncjs-util');

const {callbackCommands} = require('./../interface');
const {checkAccess} = require('./../authentication');
const {createInvoiceMessage} = require('./../messages');
const {editQuestions} = require('./../interface');
const {failureMessage} = require('./../messages');
const {getAmountAsTokens} = require('./../interface');
const invoiceActionType = require('./invoice_action_type');
const {postCreatedInvoice} = require('./../post');

const {isArray} = Array;
const {isInteger} = Number;
const isNumber = n => !isNaN(n);
const split = n => n.split('\n');

/** Update the details of a created invoice from reply input

  {
    api: <Bot API Object>
    ctx: <Telegram Context Object>
    id: <Connected User Id Number>
    nodes: [{
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

        return getAmountAsTokens({
          request,
          amount: ctx.update.message.text,
          lnd: node.lnd,
        },
        cbk);
      })],

      // Details for the updated new invoice
      updated: [
        'details',
        'getTokens',
        'type',
        ({details, getTokens, type}, cbk) =>
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
          return cbk(null, {tokens, description: text});

        // Updating the invoice amount
        case callbackCommands.setInvoiceTokens:
          // Revert back to the last good tokens when there is a parse fail
          return cbk(null, {
            description,
            tokens: !!getTokens.value ? getTokens.value.tokens : tokens,
          });

        default:
          return cbk();
        }
      }],

      // Post the invoice
      postInvoice: ['details', 'updated', ({details, updated}, cbk) => {
        // Exit early when there is no update
        if (!updated) {
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
      postFailure: ['getTokens', async ({getTokens}) => {
        // Exit early when there is no failure
        if (!getTokens.error) {
          return;
        }

        const [, message] = getTokens.error;

        const failure = failureMessage({});

        try {
          await ctx.reply(message, failure.actions);
        } catch (err) {
          // Ignore errors
        }
      }],
    },
    returnResult({reject, resolve}, cbk));
  });
};
