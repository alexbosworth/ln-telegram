const asyncAuto = require('async/auto');
const asyncMap = require('async/map');
const {getChannel} = require('ln-service');
const {getNode} = require('ln-service');
const {getWalletInfo} = require('ln-service');
const {returnResult} = require('asyncjs-util');

const consolidateForwards = require('./consolidate_forwards');

const asBigUnit = tokens => (tokens / 1e8).toFixed(8);
const asPercent = (fee, tokens) => (fee / tokens * 100).toFixed(2);
const asPpm = (fee, tokens) => (fee / tokens * 1e6).toFixed();
const consolidate = forwards => consolidateForwards({forwards}).forwards;
const escape = text => text.replace(/[_[\]()~>#+\-=|{}.!\\]/g, '\\\$&');
const {isArray} = Array;
const sanitize = n => (n || '').replace(/_/g, '\\_').replace(/[*~`]/g, '');
const uniq = arr => Array.from(new Set(arr));
const markdown = {parse_mode: 'MarkdownV2'};

/** Notify Telegram of forwarded payments

  {
    forwards: [{
      fee: <Forward Fee Tokens Earned Number>
      incoming_channel: <Standard Format Incoming Channel Id String>
      outgoing_channel: <Standard Format Outgoing Channel Id String>
      tokens: <Forwarded Tokens Number>
    }]
    from: <From Node Name String>
    id: <Connected User Id Number>
    key: <Telegram API Key String>
    lnd: <Authenticated LND API Object>
    node: <From Node Public Key Hex String>
    request: <Request Function>
  }
*/
module.exports = ({api, forwards, from, id, lnd, node}, cbk) => {
  return new Promise((resolve, reject) => {
    return asyncAuto({
      // Check arguments
      validate: cbk => {

        if (!api) {
          return cbk([400, 'ExpectedTelegramApiObjectToNotifyOfForwards']);
        }

        if (!isArray(forwards)) {
          return cbk([400, 'ExpectedForwardsArrayToNotifyOfForwards']);
        }

        if (!from) {
          return cbk([400, 'ExpectedFromNodeNameToNotifyOfForwards']);
        }

        if (!id) {
          return cbk([400, 'ExpectedConnectedUserIdToNotifyOfForwards']);
        }

        if (!lnd) {
          return cbk([400, 'ExpectedLndToNotifyOfForwards']);
        }

        if (!node) {
          return cbk([400, 'ExpectedFromNodePublicKeyToNotifyOfForwards']);
        }

        return cbk();
      },

      // Get channel details
      getChannels: ['validate', ({}, cbk) => {
        const channels = []
          .concat(forwards.map(n => n.incoming_channel))
          .concat(forwards.map(n => n.outgoing_channel));

        return asyncMap(uniq(channels), (id, cbk) => {
          return getChannel({id, lnd}, (err, res) => {
            // Ignore errors
            if (!!err) {
              return cbk();
            }

            const policy = res.policies.find(n => n.public_key !== node);

            return cbk(null, {id, key: policy.public_key});
          });
        },
        cbk);
      }],

      // Get nodes associated with channels
      getNodes: ['getChannels', ({getChannels}, cbk) => {
        return asyncMap(getChannels.filter(n => !!n), (channel, cbk) => {
          return getNode({
            lnd,
            is_omitting_channels: true,
            public_key: channel.key,
          },
          (err, res) => {
            // Ignore errors
            if (!!err) {
              return cbk();
            }

            return cbk(null, {alias: res.alias, key: channel.key});
          });
        },
        cbk);
      }],

      // Send message to Telegram
      notify: ['getChannels', 'getNodes', async ({getChannels, getNodes}) => {
        if (!forwards.length) {
          return;
        }

        const channels = getChannels.filter(n => !!n);
        const nodes = getNodes.filter(n => !!n);

        const details = consolidate(forwards).map(forward => {
          const inboundChannel = channels
            .find(channel => channel.id === forward.incoming_channel) || {};

          const outboundChannel = channels
            .find(channel => channel.id === forward.outgoing_channel) || {};

          const inbound = nodes.find(({key}) => key === inboundChannel.key);
          const outbound = nodes.find(({key}) => key === outboundChannel.key);

          return {
            fee: forward.fee,
            inbound: inbound || {channel: forward.incoming_channel},
            outbound: outbound || {channel: forward.outgoing_channel},
            tokens: forward.tokens,
          };
        });

        const allForwards = details.map(({fee, inbound, outbound, tokens}) => {
          const feePercent = asPercent(fee, tokens);
          const feeRate = asPpm(fee, tokens);
          const fromPeer = inbound.alias || inbound.key || inbound.channel;
          const toPeer = outbound.alias || outbound.key || outbound.channel;

          const action = `Forwarded ${asBigUnit(tokens)}`;
          const between = `${sanitize(fromPeer)} *→* ${sanitize(toPeer)}`;
          const feeInfo = `${asBigUnit(fee)} ${feePercent}% (${feeRate})`;

          return `${action} ${between}. Earned ${feeInfo}`;
        });

        const text = `💰 ${allForwards.join('\n')} - ${from}`;

        return await api.sendMessage(id, escape(text), markdown);
      }],
    },
    returnResult({reject, resolve}, cbk));
  });
};
