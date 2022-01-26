const asyncAuto = require('async/auto');
const {InlineKeyboard} = require('grammy');
const {returnResult} = require('asyncjs-util');

const {icons} = require('./../interface');

const escape = text => text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\\$&');
const makeKeyboard = () => new InlineKeyboard();
const maxCommandDelayMs = 1000 * 10;
const msSince = epoch => Date.now() - (epoch * 1e3);
const parseMode = 'MarkdownV2';
const removeMessageKeyboard = kb => kb.text('OK', 'remove-message');
const title = 'Editing past messages is not supported.';

/** Handle edits of past messages

  {
    ctx: <Telegram Object>
  }

  @returns via cbk or Promise
*/
module.exports = ({ctx}, cbk) => {
  return new Promise((resolve, reject) => {
    return asyncAuto({
      // Check arguments
      validate: cbk => {
        if (!ctx) {
          return cbk([400, 'ExpectedTelegramContextToHandleEditedMessage']);
        }

        return cbk();
      },

      // Post a warning message that editing past messages is not supported
      warn: ['validate', async ({}) => {
        // Exit early when there is no edited message
        if (!ctx.update || !ctx.update.edited_message) {
          return;
        }

        const message = ctx.update.edited_message;

        // Ignore messages that are old
        if (msSince(ctx.update.edited_message.date) > maxCommandDelayMs) {
          return;
        }

        // Post the warning message that the bot doesn't respond to edits
        return await ctx.reply(`${icons.warning} *${escape(title)}*`, {
          parse_mode: parseMode,
          reply_markup: removeMessageKeyboard(makeKeyboard()),
        });
      }],
    },
    returnResult({reject, resolve}, cbk));
  });
};
