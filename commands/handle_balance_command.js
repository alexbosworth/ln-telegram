const asyncAuto = require('async/auto');
const asyncMap = require('async/map');
const {getNodeFunds} = require('ln-sync');
const {returnResult} = require('asyncjs-util');

const {checkAccess} = require('./../authentication');
const {fundsSummary} = require('./../messages');

const {isArray} = Array;
const markup = {parse_mode: 'MarkdownV2'};

/** See the balance of funds

  Syntax of command:

  /balance

  {
    from: <Command From User Id Number>
    id: <Connected User Id Number>
    nodes: [{
      from: <From Name String>
      lnd: <Authenticated LND API Object>
      public_key: <Public Key Hex String>
    }]
    reply: <Reply Function>
    working: <Working Function>
  }
*/
module.exports = (args, cbk) => {
  return new Promise((resolve, reject) => {
    return asyncAuto({
      // Check arguments
      validate: cbk => {
        if (!args.from) {
          return cbk([400, 'ExpectedFromUserIdNumberForBalanceCommand']);
        }

        if (!args.id) {
          return cbk([400, 'ExpectedConnectedIdNumberForBalanceCommand']);
        }

        if (!isArray(args.nodes)) {
          return cbk([400, 'ExpectedListOfConnectedNodesForBalanceCommand']);
        }

        if (!args.reply) {
          return cbk([400, 'ExpectedReplyFunctionForFundsCommand']);
        }

        if (!args.working) {
          return cbk([400, 'ExpectedWorkingFunctionForFundsCommand']);
        }

        return cbk();
      },

      // Authenticate the command caller is authorized to this command
      checkAccess: ['validate', ({}, cbk) => {
        return checkAccess({from: args.from, id: args.id}, cbk);
      }],

      // Notify of record lookup time
      working: ['checkAccess', async ({}) => {
        try {
          return await args.working();
        } catch (err) {
          // Ignore errors notifying working
          return;
        }
      }],

      // Fetch balance information
      getBalances: ['checkAccess', ({}, cbk) => {
        return asyncMap(args.nodes, (node, cbk) => {
          return getNodeFunds({is_confirmed: true, lnd: node.lnd}, cbk);
        },
        cbk);
      }],

      // Put together funds report
      message: ['getBalances', async ({getBalances}, cbk) => {
        const {message} = fundsSummary({
          balances: getBalances,
          nodes: args.nodes,
        });

        return await args.reply(message, markup);
      }],
    },
    returnResult({reject, resolve}, cbk));
  });
};
