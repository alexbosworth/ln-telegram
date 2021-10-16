const asyncAuto = require('async/auto');
const asyncMap = require('async/map');
const {findKey} = require('ln-sync');
const {formatTokens} = require('ln-sync');
const {getChannels} = require('ln-service');
const {getLiquidity} = require('ln-sync');
const {getNodeAlias} = require('ln-sync');
const {returnResult} = require('asyncjs-util');

const checkAccess = require('./check_access');
const interaction = require('./../interaction');
const {sendMessage} = require('./../post');

const {isArray} = Array;
const peerTitle = (query, k) => `*${query} ${k.substring(0, 8)} liquidity:*`;
const sanitize = n => (n || '').replace(/_/g, '\\_').replace(/[*~`]/g, '');
const uniq = arr => Array.from(new Set(arr));

/** Check peer liquidity

  Syntax of command:

  /liquidity <peer>

  {
    from: <Command From User Id Number>
    id: <Connected User Id Number>
    key: <Telegram API Key String>
    nodes: [{
      from: <From Name String>
      lnd: <Authenticated LND API Object>
      public_key: <Public Key Hex String>
    }]
    reply: <Reply Function>
    request: <Request Function>
    text: <Original Command Text String>
    working: <Working Function>
  }
*/
module.exports = (args, cbk) => {
  return new Promise((resolve, reject) => {
    return asyncAuto({
      // Check arguments
      validate: cbk => {
        if (!args.from) {
          return cbk([400, 'ExpectedFromUserIdNumberForLiquidityCommand']);
        }

        if (!args.id) {
          return cbk([400, 'ExpectedConnectedIdNumberForLiquidityCommand']);
        }

        if (!args.key) {
          return cbk([400, 'ExpectedTelegramApiKeyForLiquidityCommand']);
        }

        if (!isArray(args.nodes)) {
          return cbk([400, 'ExpectedNodesForLiquidityCommand']);
        }

        if (!args.reply) {
          return cbk([400, 'ExpectedReplyFunctionForLiquidityCommand']);
        }

        if (!args.request) {
          return cbk([400, 'ExpectedRequestFunctionForLiquidityCommand']);
        }

        if (!args.text) {
          return cbk([400, 'ExpectedOriginalCommandTextForLiquidityCommand']);
        }

        return cbk();
      },

      // Authenticate the command caller is authorized to this command
      checkAccess: ['validate', ({}, cbk) => {
        return checkAccess({
          from: args.from,
          id: args.id,
          reply: args.reply,
        },
        cbk);
      }],

      // Derive the query if present
      query: ['checkAccess', ({}, cbk) => {
        const [, query] = args.text.split(' ');

        return cbk(null, query);
      }],

      // Get public key filter
      getKey: ['query', ({query}, cbk) => {
        if (!query) {
          return cbk();
        }

        args.working();

        return asyncMap(args.nodes, (node, cbk) => {
          return getChannels({lnd: node.lnd}, (err, res) => {
            if (!!err) {
              return cbk(err);
            }

            return findKey({
              query,
              channels: res.channels,
              lnd: node.lnd,
            },
            (err, found) => {
              if (!!err) {
                return cbk();
              }

              return cbk(null, found.public_key);
            });
          });
        },
        cbk);
      }],

      // Liquidity with peer
      withPeer: ['getKey', ({getKey}, cbk) => {
        if (!getKey) {
          return cbk();
        }

        const [withPeer, other] = uniq(getKey.filter(n => !!n));

        if (!withPeer || !!other) {
          sendMessage({
            key: args.key,
            id: args.id,
            request: args.request,
            text: interaction.peer_not_found,
          },
          err => {});

          return cbk([404, 'FailedToFindPeerMatch']);
        }

        return cbk(null, withPeer);
      }],

      // Fetch inbound liquidity information
      getInboundLiquidity: ['withPeer', ({withPeer}, cbk) => {
        args.working();

        return asyncMap(args.nodes, (node, cbk) => {
          return getLiquidity({lnd: node.lnd, with: withPeer}, (err, res) => {
            if (!!err) {
              return cbk(err);
            }

            return cbk(null, {
              balance: res.tokens.reduce((sum, n) => sum + n, Number()),
              public_key: node.public_key,
            });
          });
        },
        cbk);
      }],

      // Fetch outbound liquidity information
      getOutboundLiquidity: ['withPeer', ({withPeer}, cbk) => {
        args.working();

        return asyncMap(args.nodes, (node, cbk) => {
          return getLiquidity({
            lnd: node.lnd,
            is_outbound: true,
            with: withPeer,
          },
          (err, res) => {
            if (!!err) {
              return cbk(err);
            }

            return cbk(null, {
              balance: res.tokens.reduce((sum, n) => sum + n, Number()),
              public_key: node.public_key,
            });
          });
        },
        cbk);
      }],

      // Put together liquidity report
      liquidity: [
        'getInboundLiquidity',
        'getOutboundLiquidity',
        'query',
        'withPeer',
        ({getInboundLiquidity, getOutboundLiquidity, query, withPeer}, cbk) =>
      {
        const report = args.nodes.map(node => {
          const inbound = getInboundLiquidity
            .find(n => n.public_key === node.public_key);

          const outbound = getOutboundLiquidity
            .find(n => n.public_key === node.public_key);

          if (!inbound.balance && !outbound.balance) {
            return '';
          }

          const inboundFormatted = formatTokens({
            is_monochrome: true,
            tokens: inbound.balance,
          });

          const outboundFormatted = formatTokens({
            is_monochrome: true,
            tokens: outbound.balance,
          });

          const lines = [
            `🌊 ${node.from}:`,
            !inbound.balance ? '' : `Inbound: ${inboundFormatted.display}`,
            !outbound.balance ? '' : `Outbound: ${outboundFormatted.display}`,
          ];

          return lines.filter(n => !!n).join('\n');
        });

        args.working();

        if (!!withPeer) {
          report.unshift(peerTitle(sanitize(query), withPeer));
        }

        sendMessage({
          id: args.id,
          key: args.key,
          request: args.request,
          text: report.join('\n\n'),
        },
        err => {});

        return cbk();
      }],
    },
    returnResult({reject, resolve}, cbk));
  });
};
