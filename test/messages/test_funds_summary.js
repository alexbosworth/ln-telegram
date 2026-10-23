const {deepEqual} = require('node:assert').strict;
const test = require('node:test');

const {fundsSummary} = require('./../../messages');

const makeBalance = overrides => {
  const balance = {
    closing_balance: 0,
    offchain_balance: 0,
    offchain_pending: 0,
    onchain_confirmed: 0,
    onchain_pending: 0,
  };

  Object.keys(overrides).forEach(k => balance[k] = overrides[k]);

  return balance;
};

const tests = [
  {
    args: {
      balances: [
        makeBalance({
          closing_balance: 1,
          offchain_balance: 2,
          offchain_pending: 3,
          onchain_confirmed: 4,
          onchain_pending: 5,
        }),
      ],
      nodes: [{
        from: 'node1',
        public_key: Buffer.alloc(33, 2).toString('hex'),
      }],
    },
    description: 'Funds summary',
    expected: [
      '🪙 *Funds:* 0\\.00000015',
      '',
      '_node1_: 0\\.00000015',
      '```',
      ' Channel Balance  0.00000002 ',
      ' Channel Pending  0.00000003 ',
      ' Closing Out      0.00000001 ',
      ' Chain Confirmed  0.00000004 ',
      ' Chain Pending    0.00000005 ',
      '',
      '```',
    ],
  },
  {
    args: {
      balances: [makeBalance({offchain_balance: 2, onchain_confirmed: 4})],
      nodes: [{
        from: 'node1',
        public_key: Buffer.alloc(33, 2).toString('hex'),
      }],
    },
    description: 'Funds summary leaves out empty balances',
    expected: [
      '🪙 *Funds:* 0\\.00000006',
      '',
      '_node1_: 0\\.00000006',
      '```',
      ' Channel Balance  0.00000002 ',
      ' Chain Confirmed  0.00000004 ',
      '',
      '```',
    ],
  },
  {
    args: {
      balances: [
        makeBalance({offchain_balance: 2}),
        makeBalance({onchain_confirmed: 4}),
      ],
      nodes: [
        {from: 'node-1', public_key: Buffer.alloc(33, 2).toString('hex')},
        {from: 'node2', public_key: Buffer.alloc(33, 3).toString('hex')},
      ],
    },
    description: 'Funds summary with multiple nodes',
    expected: [
      '*Funds:* 0\\.00000006',
      '',
      '_🪙 node\\-1_: 0\\.00000002',
      '```',
      ' Channel Balance  0.00000002 ',
      '',
      '```_🪙 node2_: 0\\.00000004',
      '```',
      ' Chain Confirmed  0.00000004 ',
      '',
      '```',
    ],
  },
  {
    args: {
      balances: [makeBalance({})],
      nodes: [{
        from: 'node1',
        public_key: Buffer.alloc(33, 2).toString('hex'),
      }],
    },
    description: 'Funds summary for a node without funds',
    expected: ['🪙 *Funds:* 0\\.00000000', '', '_node1_: 0\\.00000000', ''],
  },
  {
    args: {
      balances: [makeBalance({offchain_balance: 2}), makeBalance({})],
      nodes: [
        {from: 'node-1', public_key: Buffer.alloc(33, 2).toString('hex')},
        {from: 'node2', public_key: Buffer.alloc(33, 3).toString('hex')},
      ],
    },
    description: 'Funds summary with multiple nodes where one has no funds',
    expected: [
      '*Funds:* 0\\.00000002',
      '',
      '_🪙 node\\-1_: 0\\.00000002',
      '```',
      ' Channel Balance  0.00000002 ',
      '',
      '```_🪙 node2_: 0\\.00000000',
      '',
    ],
  },
];

tests.forEach(({args, description, expected}) => {
  return test(description, (context, end) => {
    const {message} = fundsSummary(args);

    deepEqual(message.split('\n'), expected, 'Got expected result');

    return end();
  });
});
