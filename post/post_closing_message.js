const asyncAuto = require('async/auto');
const asyncMap = require('async/map');
const {getNodeAlias} = require('ln-sync');
const {returnResult} = require('asyncjs-util');

const {icons} = require('./../interface');
const {formatTokens} = require('./../interface');

const channelPoint = n => `${n.transaction_id}:${n.transaction_vout}`;
const escape = text => text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\\$&');
const {isArray} = Array;
const joinLines = lines => lines.filter(n => !!n).join('\n');
const markup = {parse_mode: 'MarkdownV2'};
const uniq = arr => Array.from(new Set(arr));

/** Send channel closing message to telegram

  {
    from: <Node From Name String>
    id: <Connected Telegram User Id String>
    lnd: <Authenticated LND API Object>
    closing: [{
      capacity: <Channel Token Capacity Number>
      partner_public_key: <Channel Partner Public Key String>
      transaction_id: <Channel Transaction Id Hex String>
      transaction_vout: <Channel Transaction Output Index Number>
    }]
    nodes: [{
      public_key: <Node Public Key Hex String>
    }]
    send: <Send Message to Telegram User Id Function>
  }

  @returns via cbk or Promise
  {
    text: <Posted Channel Closing Message String>
  }
*/
module.exports = ({closing, from, id, lnd, nodes, send}, cbk) => {
  return new Promise((resolve, reject) => {
    return asyncAuto({
      // Check arguments
      validate: cbk => {
        if (!isArray(closing)) {
          return cbk([400, 'ExpectedClosingChannelsToPostClosingMessage']);
        }

        if (!from) {
          return cbk([400, 'ExpectedFromNameToPostChannelClosingMessage']);
        }

        if (!id) {
          return cbk([400, 'ExpectedUserIdToPostChannelClosingMessage']);
        }

        if (!lnd) {
          return cbk([400, 'ExpectedLndToPostChannelClosingMessage']);
        }

        if (!isArray(nodes)) {
          return cbk([400, 'ExpectedArrayOfSavedNodesToPostClosingMessage']);
        }

        if (!send) {
          return cbk([400, 'ExpectedSendFunctionToPostChanClosingMessage']);
        }

        return cbk();
      },

      // Get peer aliases
      getAliases: ['validate', ({}, cbk) => {
        const ids = uniq(closing.map(n => n.partner_public_key));

        return asyncMap(ids, (id, cbk) => getNodeAlias({id, lnd}, cbk), cbk);
      }],

      // Put together the message to summarize the channels closing
      message: ['getAliases', ({getAliases}, cbk) => {
        const [, otherNode] = nodes;

        const details = closing.map(chan => {
          const amount = formatTokens(chan.capacity);
          const node = getAliases.find(n => n.id === chan.partner_public_key);

          const peer = escape(`${node.alias} ${node.id}`.trim());

          const details = [
            `${icons.closing} Closing ${escape(amount)} channel with ${peer}`,
            `*Funding Outpoint:* \`${channelPoint(chan)}\``,
          ];

          return joinLines(details);
        });

        const lines = [
          joinLines(details),
          !!otherNode ? `_${escape(from)}_` : '',
        ];

        return cbk(null, joinLines(lines));
      }],

      // Send the channel closing message
      send: ['message', async ({message}) => await send(id, message, markup)],
    },
    returnResult({reject, resolve, of: 'message'}, cbk));
  });
};
