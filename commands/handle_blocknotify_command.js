const asyncAuto = require('async/auto');
const {returnResult} = require('asyncjs-util');
const {subscribeToBlocks} = require('goldengate');

const interaction = require('./../interaction');

const delay = 1000 * 60;
const escape = text => text.replace(/[_[\]()~`>#+\-=|{}.!\\]/g, '\\\$&');
const join = arr => arr.join('. ');
const network = 'btc';

/** Get notified on a block

  Syntax of command:

  /blocknotify

  {
    reply: <Reply Function>
    request: <Request Function>
  }

  @returns via cbk or Promise
*/
module.exports = ({reply, request}, cbk) => {
  return new Promise((resolve, reject) => {
    return asyncAuto({
      // Check arguments
      validate: cbk => {
        if (!reply) {
          return cbk([400, 'ExpectedReplyFunctionToHandleBlockNotifyCommand']);
        }

        if (!request) {
          return cbk([400, 'ExpectedRequestFunctionToHandleBlocknotifyCmd']);
        }

        return cbk();
      },

      // Wait for block
      wait: ['validate', ({}, cbk) => {
        let currentHeight;
        const sub = subscribeToBlocks({delay, network, request});

        sub.on('block', ({height}) => {
          const heightMessage = `Chain height is now ${height}`;

          // Exit early when there is no current height
          if (!currentHeight) {
            currentHeight = height;

            const joinedMessage = join([interaction.requesting_block_notification, heightMessage]);      

            return reply(escape(joinedMessage));
          }

          const joinedMessage = join([interaction.block_notification, heightMessage]);

          reply(escape(joinedMessage));

          sub.removeAllListeners();

          return cbk();
        });

        sub.on('error', err => {
          sub.removeAllListeners();

          return cbk([503, 'UnexpectedErrorGettingBlock', {err}]);
        });

        return;
      }],
    },
    returnResult({reject, resolve}, cbk));
  });
};
