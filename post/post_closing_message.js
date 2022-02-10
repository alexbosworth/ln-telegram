const asyncAuto = require('async/auto');
const {getNode} = require('ln-service');
const {getChannels} = require('ln-service');
const {returnResult} = require('asyncjs-util');

const channelPoint = (txid, tx_vout) => `${txid}:${tx_vout}`;
const escape = text => text.replace(/[_[\]()~`>#+\-=|{}.!\\]/g, '\\\$&');
const markup = {parse_mode: 'MarkdownV2'};
const textJoiner = '\n';
const tokensAsBigTok = tokens => (tokens / 1e8).toFixed(8);

/** Post a channel closing message for Telegram

  {
    from: <Node From String>
    id: <Connected Telegram User Id String>
    lnd: <Authenticated LND API Object>
    transaction_id: <Funding transaction Id String>
    transaction_vout: <Funding transaction output Index>
    send: <Send Message to Telegram User Function>
  }

  @returns via cbk or Promise
  {
    text: <Channel Closing Message Text String>
  }
*/
module.exports = (args, cbk) => {
  return new Promise((resolve, reject) => {
    return asyncAuto({
      // Check arguments
      validate: cbk => {
        if (!args.from) {
          return cbk([400, 'ExpectedFromNodeToPostClosingMessage']);
        }

        if (!args.id) {
          return cbk([400, 'ExpectedConnectedUserIdToPostClosingMessage'])
        }

        if (!args.lnd) {
          return cbk([400, 'ExpectedAuthenticatedLndToPostClosingMessage']);
        }

        if (!args.send) {
          return cbk([400, 'ExpectedSendFunctionToPostClosingMessage']);
        }

        if (!args.transaction_id) {
          return cbk([400, 'ExpectedTransactionIdToPostClosingMessage']);
        }

        if (args.transaction_vout === undefined) {
          return cbk([400, 'ExpectedTransactionVoutToPostClosingMessage']);
        }

        return cbk();
      },

      //Get closing channel details
      getClosingChannel: ['validate', ({}, cbk) => {
          return getChannels({lnd: args.lnd}, (err, res) => {
            if (!!err) {
              return cbk([400, 'FailedToGetChannelsToPostClosingMessage', err]);
            }

            const closing = res.channels.find(n => {
              return n.transaction_id === args.transaction_id;
            });

            if (!closing) {
              return cbk([400, 'FailedToFindChannelToPostClosingMessage']);
            }
  
            return cbk(null, closing);
          });
      }],

      //Get Closing peer
      getClosingPeer: ['getClosingChannel', ({getClosingChannel}, cbk) => {
        return getNode({lnd: args.lnd, public_key: getClosingChannel.partner_public_key}, (err, res) => {
          if (!!err) {
            return cbk([400, 'FailedToGetClosingPeerToPostClosingMessage', err]);
          }
          const closingPeer = {
            alias: res.alias,
            capacity: getClosingChannel.capacity,
            partner_public_key: getClosingChannel.partner_public_key,
            transaction_id: args.transaction_id,
            transaction_vout: args.transaction_vout,
          }
          return cbk(null, closingPeer);
        });
      }],

      //build the closing message
      message: ['getClosingPeer', ({getClosingPeer}, cbk) => {
        const closingPeer = getClosingPeer;
        const details = [
          `⏳ Closing ${tokensAsBigTok(closingPeer.capacity)} with ${closingPeer.alias} ${closingPeer.partner_public_key}`,
          `*Funding Outpoint:* ${channelPoint(closingPeer.transaction_id, closingPeer.transaction_vout)}`,
          `${args.from}`,
        ];

        const text = escape(`${details.join(textJoiner)}`);

        return cbk(null, {text});
      }],

      // Send channel closing message
      send: ['message', async ({message}) => {
        return await args.send(args.id, message.text, markup);
      }],
    },
    returnResult({reject, resolve, of: 'message'}, cbk));
  });
};
