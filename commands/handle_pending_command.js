const asyncAuto = require('async/auto');
const asyncMap = require('async/map');
const {getChannels} = require('ln-service');
const {getHeight} = require('ln-service');
const {getNodeAlias} = require('ln-sync');
const {getPendingChannels} = require('ln-service');
const {returnResult} = require('asyncjs-util');

const {checkAccess} = require('./../authentication');
const pendingPayments = require('./pending_payments');
const pendingSummary = require('./pending_summary');

const blocksAsEpoch = blocks => Date.now() + blocks * 1000 * 60 * 10;
const flatten = arr => [].concat(...arr);
const {isArray} = Array;
const join = lines => lines.join('\n').trim();
const markup = {parse_mode: 'MarkdownV2'};
const sumOf = arr => arr.reduce((sum, n) => sum + n, Number());
const uniq = arr => Array.from(new Set(arr));

/** Handle pending command

  {
    from: <Command From User Id Number>
    id: <Connected User Id Number>
    nodes: [{
      from: <From Name String>
      lnd: <Authenticated LND API Object>
      public_key: <Public Key Hex String>
    }]
    reply: <Reply to Telegram Context Function>
    working: <Working Function>
  }

  @returns via cbk or Promise
*/
module.exports = ({from, id, nodes, reply, working}, cbk) => {
  return new Promise((resolve, reject) => {
    return asyncAuto({
      // Check arguments
      validate: cbk => {
        if (!from) {
          return cbk([400, 'ExpectedFromUserIdNumberForPendingCommand']);
        }

        if (!isArray(nodes)) {
          return cbk([400, 'ExpectedNodesToHandlePendingCommand']);
        }

        if (!reply) {
          return cbk([400, 'ExpectedReplyFunctionToHandlePendingCommand']);
        }

        if (!working) {
          return cbk([400, 'ExpectedWorkingFunctionToHandlePendingCommand']);
        }

        return cbk();
      },

      // Authenticate the command caller is authorized to this command
      checkAccess: ['validate', ({}, cbk) => {
        return checkAccess({from, id, reply}, cbk);
      }],

      // Get HTLCs in channels
      getHtlcs: ['checkAccess', ({}, cbk) => {
        working();

        return asyncMap(nodes, ({from, lnd}, cbk) => {
          return getChannels({lnd}, (err, res) => {
            if (!!err) {
              return cbk(err);
            }

            const {forwarding, sending} = pendingPayments({
              channels: res.channels,
            });

            const peers = []
              .concat(forwarding.map(n => n.in_peer))
              .concat(forwarding.map(n => n.out_peer))
              .concat(sending.map(n => n.out_peer));

            return asyncMap(uniq(peers), (id, cbk) => {
              return getNodeAlias({id, lnd}, cbk);
            },
            (err, nodes) => {
              if (!!err) {
                return cbk(err);
              }

              return cbk(null, {forwarding, from, nodes, sending});
            });
          });
        },
        cbk);
      }],

      // Get pending channels
      getPending: ['checkAccess', ({}, cbk) => {
        return asyncMap(nodes, ({from, lnd}, cbk) => {
          return getPendingChannels({lnd}, (err, res) => {
            if (!!err) {
              return cbk(err);
            }

            // Pending closing channels
            const closing = res.pending_channels
              .filter(n => !!n.is_closing)
              .map(channel => ({
                close_transaction_id: channel.close_transaction_id,
                is_partner_initiated: channel.is_partner_initiated,
                partner_public_key: channel.partner_public_key,
                pending_balance: channel.pending_balance,
                timelock_expiration: channel.timelock_expiration,
                transaction_id: channel.transaction_id,
              }));

            // Pending opening channels
            const opening = res.pending_channels
              .filter(n => !!n.is_opening)
              .map(channel => ({
                is_partner_initiated: channel.is_partner_initiated,
                local_balance: channel.local_balance,
                partner_public_key: channel.partner_public_key,
                remote_balance: channel.remote_balance,
                transaction_fee: channel.transaction_fee,
                transaction_id: channel.transaction_id,
              }));

            const peers = []
              .concat(closing.map(n => n.partner_public_key))
              .concat(opening.map(n => n.partner_public_key));

            return asyncMap(uniq(peers), (id, cbk) => {
              return getNodeAlias({id, lnd}, cbk);
            },
            (err, nodes) => {
              if (!!err) {
                return cbk(err);
              }

              return getHeight({lnd}, (err, res) => {
                if (!!err) {
                  return cbk(err);
                }

                const height = res.current_block_height;

                return cbk(null, {closing, from, height, nodes, opening});
              });
            });
          });
        },
        cbk);
      }],

      // Notify of pending forwards and channels
      notify: ['getHtlcs', 'getPending', async ({getHtlcs, getPending}) => {
        const summary = pendingSummary({htlcs: getHtlcs, pending: getPending});

        return await reply(join(summary), markup);
      }],
    },
    returnResult({reject, resolve}, cbk));
  });
};
