const asyncAuto = require('async/auto');
const {returnResult} = require('asyncjs-util');

const message = '🤖 Unexpected button pushed. This button may no longer be supported?';

const {failureMessage} = require('./../messages');

/** User pressed an unknown button

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
          return cbk([400, 'ExpectedTelegramContextToHandleUnknownButton']);
        }

        return cbk();
      },

      // Post a failure message
      failure: ['validate', async ({}) => {
        return await ctx.reply(message, failureMessage({}).actions);
      }],

      // Stop the loading message
      respond: ['validate', async ({}) => await ctx.answerCallbackQuery()],
    },
    returnResult({reject, resolve}, cbk));
  });
};
