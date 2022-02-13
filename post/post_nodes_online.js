const asyncAuto = require('async/auto');
const {returnResult} = require('asyncjs-util');

const {icons} = require('./../interface');

const commaJoin = arr => arr.join(', ');
const escape = text => text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\\$&');
const {isArray} = Array;
const markup = {parse_mode: 'MarkdownV2'};

/** Post that nodes are now online

  {
    id: <Connected User Id Number>
    nodes: [{
      alias: <Node Alias String>
      id: <Node Identity Public Key Hex String>
    }]
    send: <Send Message to Telegram Function>
  }

  @returns via cbk or Promise
*/
module.exports = ({id, nodes, send}, cbk) => {
  return new Promise((resolve, reject) => {
    return asyncAuto({
      // Check arguments
      validate: cbk => {
        if (!id) {
          return cbk([400, 'ExpectedConnectedUserIdToPostOnlineNotification']);
        }

        if (!isArray(nodes)) {
          return cbk([400, 'ExpectedNodesToPostOnlineNotification']);
        }

        if (!send) {
          return cbk([400, 'ExpectedSendFunctionToPostOnlineNotification']);
        }

        return cbk();
      },

      // Message to send
      message: ['validate', ({}, cbk) => {
        const names = nodes.map(node => (node.alias || node.id).trim());

        const text = `${icons.bot} Connected to ${commaJoin(names)}`;

        return cbk(null, `_${escape(text)}_`);
      }],

      // Send the connected message
      send: ['message', async ({message}) => await send(id, message, markup)],
    },
    returnResult({reject, resolve, of: 'message'}, cbk));
  });
};
