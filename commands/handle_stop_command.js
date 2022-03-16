const asyncAuto = require('async/auto');
const {returnResult} = require('asyncjs-util');

const {checkAccess} = require('./../authentication');
const {stopBotMessage} = require('./../messages');

const markup = {parse_mode: 'MarkdownV2'};
const replyMarkdownV1 = reply => n => reply(n, {parse_mode: 'Markdown'});

/** Execute stop command to stop the bot

  {
    from: <Command From User Id Number>
    id: <Connected User Id Number>
    quit: <Stop Bot Function>
    reply: <Reply Function>
  }

  @returns via cbk or Promise
*/
module.exports = ({from, id, reply}, cbk) => {
  return new Promise((resolve, reject) => {
    return asyncAuto({
      // Check arguments
      validate: cbk => {
        if (!from) {
          return cbk([400, 'ExpectedFromUserIdToExecuteStopCommand']);
        }

        if (!reply) {
          return cbk([400, 'ExpectedReplyFunctionToExecuteStopCommand']);
        }

        return cbk();
      },

      // Confirm the connected user issued the command
      checkAccess: ['validate', ({}, cbk) => {
        return checkAccess({from, id, reply: replyMarkdownV1(reply)}, cbk);
      }],

      // Notify the chat that the bot would stop
      notify: ['checkAccess', async ({}) => {
        const {markup, mode, text} = stopBotMessage({});

        return await reply(text, {parse_mode: mode, reply_markup: markup});
      }],
    },
    returnResult({reject, resolve}, cbk));
  });
};
