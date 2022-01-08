const asyncAuto = require('async/auto');
const {InlineKeyboard} = require('grammy');
const {returnResult} = require('asyncjs-util');

const {callbackCommands} = require('./../interface');
const {labels} = require('./../interface');

const {isArray} = Array;
const nodeLabel = named => `Node: ${named}`;
const rowsIndex = 2;
const shortId = key => key.slice(0, 46);
const switchNode = id => `${callbackCommands.moveInvoiceNode}${id}`;

/** User pressed a set node invoice button

  {
    ctx: <Telegram Context Object>
    nodes: [{
      from: <Saved Node Name String>
      public_key: <Saved Node Identity Public Key Hex String>
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
          return cbk([400, 'ExpectedTelegramContextToHandleInvoiceNodePress']);
        }

        if (!isArray(nodes)) {
          return cbk([400, 'ExpectedArrayOfSavedNodesToHandleSetInvoiceNode']);
        }

        return cbk();
      },

      // Add the saved nodes to the message
      edit: ['validate', async ({}) => {
        const markup = new InlineKeyboard();

        // Invoice have a set of edit buttons
        const editButtons = [
          [
            labels.invoiceMessageDescriptionButtonLabel,
            callbackCommands.setInvoiceDescription,
          ],
          [
            labels.invoiceMessageSetTokensButtonLabel,
            callbackCommands.setInvoiceTokens,
          ],
          [
            labels.invoiceMessageCancelButtonLabel,
            callbackCommands.cancelInvoice,
          ],
        ];

        // Map nodes to buttons
        const nodeButtons = nodes.map(node => {
          return [nodeLabel(node.from), switchNode(shortId(node.public_key))];
        });

        const buttons = [].concat(editButtons).concat(nodeButtons);

        // Add buttons to message markup
        buttons.forEach(([label, command], i) => {
          if (i < rowsIndex) {
            return markup.text(label, command);
          } else {
            return markup.text(label, command).row();
          }
        });

        // Post the original message but with move node buttons
        return await ctx.editMessageText(
          ctx.update.callback_query.message.text,
          {
            entities: ctx.update.callback_query.message.entities,
            reply_markup: markup,
          },
        );
      }],

      // Stop the loading message
      respond: ['validate', async ({}) => await ctx.answerCallbackQuery()],
    },
    returnResult({reject, resolve}, cbk));
  });
};
