const asyncAuto = require('async/auto');
const {InlineKeyboard} = require('grammy');
const {returnResult} = require('asyncjs-util');

const {callbackCommands} = require('./../interface');
const {labels} = require('./../interface');
const {tradeEditButtons} = require('./../messages');

const {isArray} = Array;
const nodeLabel = named => `Node: ${named}`;
const switchNode = id => `${callbackCommands.moveInvoiceNode}${id}`;

/** User pressed a set trade node button

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
          return cbk([400, 'ExpectedTelegramContextToHandleTradeNodePress']);
        }

        if (!isArray(nodes)) {
          return cbk([400, 'ExpectedArrayOfSavedNodesToHandleSetTradeNode']);
        }

        return cbk();
      },

      // Add the saved nodes to the message
      edit: ['validate', async ({}) => {
        const {markup} = tradeEditButtons({nodes, is_selecting: true});

        // Post the original message but with updated buttons
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
