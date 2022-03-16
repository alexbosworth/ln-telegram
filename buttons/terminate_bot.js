const asyncAuto = require('async/auto');
const {returnResult} = require('asyncjs-util');

const {icons} = require('./../interface');

const escape = text => text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\\$&');
const markup = {parse_mode: 'MarkdownV2'};
const shutdownMessage = `${icons.bot} Bot shutting down...`

/** User pressed terminate bot button

  {
    ctx: <Telegram Context Object>
    bot: <Telegram Bot Object>
    exit: <Process Exit Function>
  }

  @returns via cbk or Promise
*/
module.exports = ({bot, ctx, exit}, cbk) => {
  return new Promise((resolve, reject) => {
    return asyncAuto({
      // Check arguments
      validate: cbk => {
        if (!bot) {
          return cbk([400, 'ExpectedBotObjectToTerminateBot']);
        }

        if (!ctx) {
          return cbk([400, 'ExpectedTelegramContextToTerminateBot']);
        }

        return cbk();
      },

      // Notify the chat that the bot is stopping
      notify: ['validate', async ({}) => {
        return await ctx.reply(escape(shutdownMessage), markup);
      }],

      // Remove the referenced message
      remove: ['validate', async ({}) => await ctx.deleteMessage()],

      // Stop the loading message
      respond: ['validate', async ({}) => await ctx.answerCallbackQuery()],

      // Gracefully stop the bot
      terminateBot: ['notify', 'remove', 'respond', async ({}) => {
        return await bot.stop();
      }],

      // Terminate the process
      exit: ['terminateBot', ({}, cbk) => {
        exit();

        return cbk();
      }],
    },
    returnResult({reject, resolve}, cbk));
  });
};
