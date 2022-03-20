const asyncAuto = require('async/auto');
const asyncMap = require('async/map');
const {getChannel} = require('ln-service');
const {getNodeAlias} = require('ln-sync');
const {getWalletInfo} = require('ln-service');
const {returnResult} = require('asyncjs-util');

const consolidateForwards = require('./consolidate_forwards');
const {formatTokens} = require('./../interface');
const {icons} = require('./../interface');

const asPercent = (fee, tokens) => (fee / tokens * 100).toFixed(2);
const asPpm = (fee, tokens) => (fee / tokens * 1e6).toFixed();
const consolidate = forwards => consolidateForwards({forwards}).forwards;
const escape = text => text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\\$&');
const {isArray} = Array;
const join = n => n.filter(n => !!n).join(' ');
const joinAsLines = n => n.join('\n');
const markup = {parse_mode: 'MarkdownV2'};
const uniq = arr => Array.from(new Set(arr));

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
    lnd: <Authenticated LND API Object>
    node: <From Node Public Key Hex String>
    nodes: [{
      public_key: <Node Public Key Hex String>
    }]
    send: <Send Message to Telegram User Function>
  }

  @returns via cbk or Promise
  {
    text: <Forward Notify Message Text String>
  }
*/
module.exports = ({forwards, from, id, lnd, node, nodes, send}, cbk) => {
  return new Promise((resolve, reject) => {
    return asyncAuto({
      // Check arguments
      validate: cbk => {
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

        if (!isArray(nodes)) {
          return cbk([400, 'ExpectedArrayOfNodesToNotifyOfForwards']);
        }

        if (!send) {
          return cbk([400, 'ExpectedSendFunctionToNotifyOfForwards']);
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
          return getNodeAlias({lnd, id: channel.key}, cbk);
        },
        cbk);
      }],

      // Construct message to send to telegram
      message: ['getChannels', 'getNodes', ({getChannels, getNodes}, cbk) => {
        // Exit early when there are no forwards
        if (!forwards.length) {
          return cbk();
        }

        const channels = getChannels.filter(n => !!n);
        const aliases = getNodes.filter(n => !!n);

        const details = consolidate(forwards).map(forward => {
          const inboundChannel = channels
            .find(channel => channel.id === forward.incoming_channel) || {};

          const outboundChannel = channels
            .find(channel => channel.id === forward.outgoing_channel) || {};

          const inbound = aliases.find(({id}) => id === inboundChannel.key);
          const outbound = aliases.find(({id}) => id === outboundChannel.key);

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
          const fromPeer = inbound.alias || inbound.id || inbound.channel;
          const toPeer = outbound.alias || outbound.id || outbound.channel;

          const between = `${escape(fromPeer)} *→* ${escape(toPeer)}`;
          const feeInfo = `${formatTokens(fee)} ${feePercent}% (${feeRate})`;

          return join([
            `${icons.earn} Forwarded ${escape(formatTokens(tokens))}`,
            `${between}${escape('.')}`,
            escape(`Earned ${feeInfo}`),
          ]);
        });

        const lines = joinAsLines(allForwards);

        const [, otherNode] = nodes;

        // Exit early when there is just a single node
        if (!otherNode) {
          return cbk(null, lines);
        }

        return cbk(null, join([lines, escape('-'), `_${escape(from)}_`]));
      }],

      // Send the forwards report message
      send: ['message', async ({message}) => {
        // Exit early when there is no message to send
        if (!message) {
          return;
        }

        return await send(id, message, markup);
      }],
    },
    returnResult({reject, resolve, of: 'message'}, cbk));
  });
};
