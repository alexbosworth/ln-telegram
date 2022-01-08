const asyncAuto = require('async/auto');
const asyncReflect = require('async/reflect');
const {parsePaymentRequest} = require('ln-service');
const {returnResult} = require('asyncjs-util');

const {editQuestions} = require('./../interface');
const {failureMessage} = require('./../messages');

const code = n => `\`${n}\``;
const inputFieldPlaceholder = 'Enter amount to invoice...';
const {isArray} = Array;
const italic = n => `_${n}_`;
const join = n => n.join('\n');
const parseFailure = msg => `⚠️ Unexpected error \`${msg}\`. Try again?`;
const parseMode = 'Markdown';
const spacer = '';
const split = n => n.split('\n');

/** User pressed button to update created invoice tokens

  {
    ctx: <Telegram Context Object>
    nodes: [{
      public_key: <Public Key Hex String>
    }]
  }

  @returns via cbk or Promise
*/
module.exports = ({ctx, nodes}, cbk) => {
  return new Promise((resolve, reject) => {
    return asyncAuto({
      // Check arguments
      validate: cbk => {
        if (!ctx) {
          return cbk([400, 'ExpectedTelegramContextToSetInvoiceTokens']);
        }

        if (!isArray(nodes)) {
          return cbk([400, 'ExpectedArrayOfNodesToSetInvoiceTokens']);
        }

        return cbk();
      },

      // Pull out the invoice payment request
      invoice: ['validate', asyncReflect(({}, cbk) => {
        const [title, request] = split(ctx.update.callback_query.message.text);

        if (!title) {
          return cbk([400, 'ExpectedInvoiceTitleOnInvoiceMessage']);
        }

        if (!request) {
          return cbk([400, 'ExpectedPaymentRequestOnInvoiceMessage']);
        }

        try {
          parsePaymentRequest({request});
        } catch (err) {
          return cbk([400, 'ExpectedValidPaymentRequestToSetInvoiceTokens']);
        }

        const {destination} = parsePaymentRequest({request});

        if (!nodes.find(n => n.public_key === destination)) {
          return cbk([400, 'MissingNodeToUpdateInvoiceDescriptionFor']);
        }

        return cbk(null, {request, title});
      })],

      // Stop the loading message
      respond: ['validate', async ({}) => await ctx.answerCallbackQuery()],

      // Post a failure to create a reply
      failure: ['invoice', async ({invoice}) => {
        if (!invoice.error) {
          return;
        }

        const [, msg] = invoice.error;

        return await ctx.reply(parseFailure(msg), failureMessage({}).actions);
      }],

      // Post the edit description message
      post: ['invoice', async ({invoice}) => {
        // Exit early when there is no invoice message
        if (!invoice.value) {
          return;
        }

        // Post the edit invoice description message
        return await ctx.reply(
          join([
            invoice.value.title,
            code(invoice.value.request),
            spacer,
            italic(editQuestions.editInvoiceTokens),
          ]),
          {
            parse_mode: parseMode,
            reply_markup: {
              force_reply: true,
              input_field_placeholder: inputFieldPlaceholder,
            },
          }
        );
      }],

      // Remove the referenced message
      remove: ['invoice', async ({invoice}) => {
        return !!invoice.error ? null : await ctx.deleteMessage();
      }],
    },
    returnResult({reject, resolve}, cbk));
  });
};
