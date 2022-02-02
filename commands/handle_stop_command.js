const asyncAuto = require('async/auto');
const {returnResult} = require('asyncjs-util');

const {checkAccess} = require('./../authentication');
const {icons} = require('./../interface');

const escape = text => text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\\$&');
const markup = {parse_mode: 'MarkdownV2'};
const replyMarkdownV1 = reply => n => reply(n, {parse_mode: 'Markdown'});
const shutdownMessage = `${icons.bot} Bot shutting down...`

/** Execute stop command to stop the bot

  {
    from: <Command From User Id Number>
    id: <Connected User Id Number>
    quit: <Stop Bot Function>
    reply: <Reply Function>
  }

  @returns via cbk or Promise
*/
module.exports = ({from, id, quit, reply}, cbk) => {
  return new Promise((resolve, reject) => {
    return asyncAuto({
      // Check arguments
      validate: cbk => {
        if (!from) {
          return cbk([400, 'ExpectedFromUserIdToExecuteStopCommand']);
        }

        if (!id) {
          return cbk([400, 'ExpectedConnectedUserIdToExecuteStopCommand']);
        }

        if (!quit) {
          return cbk([400, 'ExpectedQuitFunctionToExecuteStopCommand']);
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

      // Notify the chat that the bot is stopping
      notify: ['checkAccess', async ({}) => {
        return await reply(escape(shutdownMessage), markup);
      }],

      // Stop the bot
      terminateBot: ['notify', async ({}) => {
        return await quit();
      }],
    },
    returnResult({reject, resolve}, cbk));
  });
};
