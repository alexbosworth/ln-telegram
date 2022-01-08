const asyncAuto = require('async/auto');
const {returnResult} = require('asyncjs-util');

/** User pressed a cancel invoice button

  {
    ctx: <Telegram Context Object>
  }

  @returns via cbk or Promise
*/
module.exports = ({ctx}, cbk) => {
  return new Promise((resolve, reject) => {
    return asyncAuto({
      // Check arguments
      validate: cbk => {
        if (!ctx) {
          return cbk([400, 'ExpectedTelegramContextToHandleCancelInvoice']);
        }

        return cbk();
      },

      // Remove the referenced invoice message
      remove: ['validate', async ({}) => await ctx.deleteMessage()],

      // Stop the loading message
      respond: ['validate', async ({}) => await ctx.answerCallbackQuery()],
    },
    returnResult({reject, resolve}, cbk));
  });
};
