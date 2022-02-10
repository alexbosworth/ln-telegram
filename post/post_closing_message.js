const asyncAuto = require('async/auto');
const asyncMap = require('async/map');
const {getNodeAlias} = require('ln-sync');
const {returnResult} = require('asyncjs-util');

const channelPoint = (txid, tx_vout) => `${txid}:${tx_vout}`;
const escape = text => text.replace(/[_[\]()~`>#+\-=|{}.!\\]/g, '\\\$&');
const {isArray} = Array;
const markup = {parse_mode: 'MarkdownV2'};
const textJoiner = '\n';
const tokensAsBigTok = tokens => (tokens / 1e8).toFixed(8);

/** Send channel closing message to telegram

  {
    from: <Node From Name String>
    id: <Connected Telegram User Id String>
    lnd: <Authenticated LND API Object>
    closing: [{
      capacity: <Channel Token Capacity Number>
      partner_public_key: <Channel Partner Public Key String>
    }]
    send: <Send Message to Telegram User Id Function>
  }

  @returns via cbk or Promise
  {
    text: <Posted Channel Closing Message String>
  }
*/
module.exports = ({closing, from, id, lnd, send}, cbk) => {
  return new Promise((resolve, reject) => {
    return asyncAuto({
      // Check arguments
      validate: cbk => {
        if (!from) {
          return cbk([400, 'ExpectedFromNameToPostChannelClosingMessage']);
        }

        if (!id) {
          return cbk([400, 'ExpectedUserIdToPostChannelClosingMessage']);
        }

        if (!lnd) {
          return cbk([400, 'ExpectedLndToPostChannelClosingMessage']);
        }

        if (!isArray(closing)) {
          return cbk([400, 'ExpectedClosingChannelsToPostChannelClosingMessage']);
        }

        if (!send) {
          return cbk([400, 'ExpectedSendFunctionToPostChanClosingMessage']);
        }

        return cbk();
      },

      // Get peer aliases
      getAliases: ['validate', ({}, cbk) => {
        return asyncMap(closing, (channel, cbk) => {
          return getNodeAlias({lnd, id: channel.partner_public_key}, cbk);
        },
        cbk);
      }],

      // Put together the message to summarize the channels closing
      message: ['getAliases', ({getAliases}, cbk) => {
        const lines = closing.map(chan => {
          const node = getAliases.find(n => n.id === chan.partner_public_key);

          const details = [
            `⏳ Closing ${tokensAsBigTok(chan.capacity)} with ${node.alias} ${node.id}`,
            `*Funding Outpoint:* ${channelPoint(chan.transaction_id, chan.transaction_vout)}`,
            `${from}`,
          ];

          return details.join(textJoiner);
        });
        const [text] = lines;

        return cbk(null, {text: escape(text)});
      }],

      // Send channel open message
      send: ['message', async ({message}) => {
        return await send(id, message.text, markup);
      }],
    },
    returnResult({reject, resolve, of: 'message'}, cbk));
  });
};
