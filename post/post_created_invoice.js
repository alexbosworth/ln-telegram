const asyncAuto = require('async/auto');
const asyncReflect = require('async/reflect');
const {createInvoice} = require('ln-service');
const {InlineKeyboard} = require('grammy');
const {returnResult} = require('asyncjs-util');

const {createInvoiceMessage} = require('./../messages');

const createFailedMessage = msg => `⚠️ *Failed to create invoice: ${msg}*`
const expiry = () => new Date(Date.now() + 1000 * 60 * 60 * 3).toISOString();
const {isArray} = Array;
const makeKeyboard = () => new InlineKeyboard();
const parseMode = 'Markdown';
const removeMessageKeyboard = kb => kb.text('OK', 'remove-message');

/** Create and post an invoice

  {
    ctx: <Telegram Context Object>
    [description]: <Invoice Description String>
    destination: <Invoice Destination Public Key Hex String>
    nodes: [{
      lnd: <Authenticated LND API Object>
      public_key: <Node Identity Public Key Hex String>
    }]
    [tokens]: <Invoice Tokens Number>
  }

  @returns via cbk or Promise
*/
module.exports = ({ctx, description, destination, nodes, tokens}, cbk) => {
  return new Promise((resolve, reject) => {
    return asyncAuto({
      // Check arguments
      validate: cbk => {
        if (!ctx) {
          return cbk([400, 'ExpectedTelegramContextToPostCreatedInvoice']);
        }

        if (!destination) {
          return cbk([400, 'ExpectedInvoiceDestinationToPostCreatedInvoice']);
        }

        if (!isArray(nodes)) {
          return cbk([400, 'ExpectedArrayOfNodesToPostCreatedInvoice']);
        }

        return cbk();
      },

      // Create the new invoice
      create: ['validate', asyncReflect(({}, cbk) => {
        return createInvoice({
          description,
          tokens,
          expires_at: expiry(),
          is_including_private_channels: true,
          lnd: nodes.find(n => n.public_key === destination).lnd,
        },
        cbk);
      })],

      // Post about a create invoice failure
      failed: ['create', async ({create}) => {
        // Exit early when create succeeded
        if (!create.error) {
          return;
        }

        const [, message] = create.error;

        return await ctx.reply(createFailedMessage(message), {
          parse_mode: parseMode,
          reply_markup: removeMessageKeyboard(makeKeyboard()),
        });
      }],

      // Post the invoice as a reply
      post: ['create', async ({create}) => {
        // Exit early when there is no created invoice
        if (!create.value) {
          return;
        }

        const node = nodes.find(n => n.public_key === destination);

        const [, other] = nodes;

        // Make the invoice message text
        const message = createInvoiceMessage({
          from: !!other ? node.from : undefined,
          request: create.value.request,
        });

        // Post the new invoice as a message
        return await ctx.reply(message.text, {
          parse_mode: message.mode,
          reply_markup: message.markup,
        });
      }],
    },
    returnResult({reject, resolve}, cbk));
  });
};
