const {deepEqual} = require('node:assert').strict;
const {rejects} = require('node:assert').strict;
const test = require('node:test');

const {listChannelsResponse} = require('./../fixtures');
const {pendingChannelsResponse} = require('./../fixtures');
const {handleBalanceCommand} = require('./../../');

const key = Buffer.alloc(33, 2).toString('hex');

const listUnspent = ({}, cbk) => {
  return cbk(null, {
    utxos: [{
      address: 'address',
      address_type: 'WITNESS_PUBKEY_HASH',
      amount_sat: '3',
      confirmations: '1',
      outpoint: {output_index: 0, txid_str: Buffer.alloc(32).toString('hex')},
      pk_script: '00',
    }],
  });
};

const makeLnd = ({err}) => {
  return {
    default: {
      listUnspent,
      getTransactions: ({}, cbk) => cbk(null, {transactions: []}),
      listChannels: ({}, cbk) => {
        if (!!err) {
          return cbk(err);
        }

        return cbk(null, listChannelsResponse);
      },
      pendingChannels: ({}, cbk) => cbk(null, pendingChannelsResponse),
    },
    wallet: {
      listUnspent,
      listLeases: ({}, cbk) => cbk(null, {locked_utxos: []}),
    },
  };
};

const makeArgs = (overrides, workingErr) => {
  const calls = {replies: [], working: 0};

  const args = {
    calls,
    from: 1,
    id: 1,
    nodes: [{from: 'node1', lnd: makeLnd({}), public_key: key}],
    reply: async (text, options) => {
      return calls.replies.push({options, text: text.split('\n')});
    },
    working: async () => {
      calls.working++;

      if (!!workingErr) {
        throw new Error(workingErr);
      }

      return;
    },
  };

  Object.keys(overrides).forEach(k => args[k] = overrides[k]);

  return args;
};

const tests = [
  {
    args: makeArgs({from: undefined}),
    description: 'The id of the user sending the command is expected',
    error: [400, 'ExpectedFromUserIdNumberForBalanceCommand'],
  },
  {
    args: makeArgs({id: undefined}),
    description: 'The id of the connected user is expected',
    error: [400, 'ExpectedConnectedIdNumberForBalanceCommand'],
  },
  {
    args: makeArgs({nodes: undefined}),
    description: 'An array of nodes is expected',
    error: [400, 'ExpectedListOfConnectedNodesForBalanceCommand'],
  },
  {
    args: makeArgs({reply: undefined}),
    description: 'A reply function is expected',
    error: [400, 'ExpectedReplyFunctionForFundsCommand'],
  },
  {
    args: makeArgs({working: undefined}),
    description: 'A working function is expected',
    error: [400, 'ExpectedWorkingFunctionForFundsCommand'],
  },
  {
    args: makeArgs({from: 2}),
    description: 'Only the connected user can see the balance',
    error: [401, 'CommandRequiresConnectCode'],
  },
  {
    args: makeArgs({
      nodes: [{from: 'node1', lnd: makeLnd({err: 'err'}), public_key: key}],
    }),
    description: 'An error getting node funds is passed back',
    error: [503, 'UnexpectedGetChannelsError', {err: 'err'}],
  },
  {
    args: makeArgs({}),
    description: 'The balance of funds is posted',
    expected: {
      replies: [{
        options: {parse_mode: 'MarkdownV2'},
        text: [
          '🪙 *Funds:* 0\\.00000007',
          '',
          '_node1_: 0\\.00000007',
          '```',
          ' Channel Balance  0.00000002 ',
          ' Channel Pending  0.00000002 ',
          ' Chain Confirmed  0.00000003 ',
          '',
          '```',
        ],
      }],
      working: 1,
    },
  },
  {
    args: makeArgs({}, 'err'),
    description: 'A failure to notify of working is ignored',
    expected: {
      replies: [{
        options: {parse_mode: 'MarkdownV2'},
        text: [
          '🪙 *Funds:* 0\\.00000007',
          '',
          '_node1_: 0\\.00000007',
          '```',
          ' Channel Balance  0.00000002 ',
          ' Channel Pending  0.00000002 ',
          ' Chain Confirmed  0.00000003 ',
          '',
          '```',
        ],
      }],
      working: 1,
    },
  },
];

tests.forEach(({args, description, error, expected}) => {
  return test(description, async () => {
    if (!!error) {
      await rejects(handleBalanceCommand(args), error, 'Got expected error');
    } else {
      await handleBalanceCommand(args);

      deepEqual(args.calls, expected, 'Got expected result');
    }

    return;
  });
});
