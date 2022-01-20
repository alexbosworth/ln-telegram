const asyncAuto = require('async/auto');
const {createInvoice} = require('ln-service');
const {parsePaymentRequest} = require('ln-service');
const {returnResult} = require('asyncjs-util');

const {callbackCommands} = require('./../interface');
const {checkAccess} = require('./../authentication');
const {createInvoiceMessage} = require('./../messages');
const {editQuestions} = require('./../interface');
const {failureMessage} = require('./../messages');
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
    nodes: [{
      lnd: <Authenticated LND API Object>
      public_key: <Node Identity Public Key Hex String>
    }]
  }

  @returns via cbk or Promise
*/
module.exports = ({api, ctx, id, nodes}, cbk) => {
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

        return cbk();
      },

      // Confirm access authorization
      checkAccess: ['validate', ({}, cbk) => {
        return checkAccess({
          id,
          from: ctx.message.from.id,
          reply: ctx.reply,
        },
        cbk);
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
        return !!type ? await ctx.deleteMessage() : null;
      }],

      // Delete the edit message that had the question
      deleteQuestion: ['type', async ({type}) => {
        if (!type) {
          return;
        }

        return await api.deleteMessage(
          ctx.update.message.reply_to_message.chat.id,
          ctx.update.message.reply_to_message.message_id,
        );
      }],

      // Details for the updated new invoice
      updated: ['details', 'type', ({details, type}, cbk) => {
        // Exit early when the type of update is not known
        if (!type) {
          return cbk();
        }

        const {description} = details;
        const {text} = ctx.update.message;
        const {tokens} = details;

        switch (type) {
        case callbackCommands.setInvoiceDescription:
          return cbk(null, {tokens, description: text});

        case callbackCommands.setInvoiceTokens:
        // Exit early when the amount is an invalid number
          if (!isNumber(text)) {
            return cbk(null, {description, tokens, is_invalid_amount: true});
          }

          // Exit early when the amount is not an integer
          if (!isInteger(Number(text))) {
            return cbk(null, {
              description,
              tokens,
              is_fractional_amount: true,
            });
          }

          return cbk(null, {description, tokens: Number(text)});

        default:
          return cbk();
        }
      }],

      // Post the failure
      postFailure: ['updated', async ({updated}) => {
        // Exit early when there is no update
        if (!updated) {
          return;
        }

        // Exit early when the amount cannot be parsed as tokens
        if (!!updated.is_invalid_amount) {
          const failure = failureMessage({is_invalid_amount: true});

          return await ctx.reply(failure.message, failure.actions);
        }

        // Exit early when the amount is fractional
        if (!!updated.is_fractional_amount) {
          const failure = failureMessage({is_fractional_amount: true});

          return await ctx.reply(failure.message, failure.actions);
        }

        return;
      }],

      // Post the invoice
      postInvoice: ['details', 'updated', ({details, updated}, cbk) => {
        // Exit early when there is no update
        if (!updated) {
          return;
        }

        return postCreatedInvoice({
          ctx,
          nodes,
          description: updated.description,
          destination: details.destination,
          tokens: updated.tokens,
        },
        cbk);
      }],
    },
    returnResult({reject, resolve}, cbk));
  });
};
