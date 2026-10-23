const {deepEqual} = require('node:assert').strict;
const test = require('node:test');

const {liquiditySummary} = require('./../../messages');

const tests = [
  {
    args: {
      inbound: [{balance: 1, public_key: Buffer.alloc(33, 2).toString('hex')}],
      nodes: [{from: 'from', public_key: Buffer.alloc(33, 2).toString('hex')}],
      outbound: [{
        balance: 2,
        public_key: Buffer.alloc(33, 2).toString('hex'),
      }],
    },
    description: 'Liquidity summary',
    expected: [
      '🌊 *Liquidity:*',
      '',
      '```',
      ' Inbound   0.00000001   ',
      ' Outbound  0.00000002   ',
      '',
      '```',
    ],
  },
  {
    args: {
      inbound: [{balance: 0, public_key: Buffer.alloc(33, 2).toString('hex')}],
      nodes: [{from: 'from', public_key: Buffer.alloc(33, 2).toString('hex')}],
      outbound: [{
        balance: 0,
        public_key: Buffer.alloc(33, 2).toString('hex'),
      }],
    },
    description: 'Liquidity summary with zero balance',
    expected: [
      '🌊 *Liquidity:*',
      '',
      '',
    ],
  },
  {
    args: {
      inbound: [{balance: 0, public_key: Buffer.alloc(33, 2).toString('hex')}],
      nodes: [{from: 'from', public_key: Buffer.alloc(33, 2).toString('hex')}],
      outbound: [{
        balance: 1,
        public_key: Buffer.alloc(33, 2).toString('hex'),
      }],
    },
    description: 'Liquidity summary with zero inbound',
    expected: [
      '🌊 *Liquidity:*',
      '',
      '```',
      ' Inbound   -            ',
      ' Outbound  0.00000001   ',
      '',
      '```',
    ],
  },
  {
    args: {
      inbound: [{balance: 1, public_key: Buffer.alloc(33, 2).toString('hex')}],
      nodes: [{from: 'from', public_key: Buffer.alloc(33, 2).toString('hex')}],
      outbound: [{
        balance: 0,
        public_key: Buffer.alloc(33, 2).toString('hex'),
      }],
    },
    description: 'Liquidity summary with zero outbound',
    expected: [
      '🌊 *Liquidity:*',
      '',
      '```',
      ' Inbound   0.00000001   ',
      ' Outbound  -            ',
      '',
      '```',
    ],
  },
  {
    args: {
      alias: 'alias',
      inbound: [
        {balance: 1, public_key: Buffer.alloc(33, 2).toString('hex')},
        {balance: 1, public_key: Buffer.alloc(33, 3).toString('hex')},
      ],
      nodes: [
        {from: 'from', public_key: Buffer.alloc(33, 2).toString('hex')},
        {from: 'more', public_key: Buffer.alloc(33, 3).toString('hex')},
      ],
      outbound: [
        {balance: 2, public_key: Buffer.alloc(33, 2).toString('hex')},
        {balance: 2, public_key: Buffer.alloc(33, 3).toString('hex')},
      ],
      peer: 'peer',
    },
    description: 'Liquidity summary with multiple nodes',
    expected: [
      '*Liquidity with alias peer:*',
      '',
      '_🌊 from_:',
      '```',
      ' Inbound   0.00000001   ',
      ' Outbound  0.00000002   ',
      '',
      '```_🌊 more_:',
      '```',
      ' Inbound   0.00000001   ',
      ' Outbound  0.00000002   ',
      '',
      '```',
    ],
  },
  {
    args: {
      inbound: [{
        balance: 1,
        fee_rate: 1000,
        public_key: Buffer.alloc(33, 2).toString('hex'),
      }],
      nodes: [{from: 'from', public_key: Buffer.alloc(33, 2).toString('hex')}],
      outbound: [{
        balance: 2,
        fee_rate: 500,
        public_key: Buffer.alloc(33, 2).toString('hex'),
      }],
    },
    description: 'Liquidity summary with fee rates',
    expected: [
      '🌊 *Liquidity:*',
      '',
      '```',
      ' Inbound   0.00000001  0.10% (1000) ',
      ' Outbound  0.00000002  0.05% (500)  ',
      '',
      '```',
    ],
  },
];

tests.forEach(({args, description, error, expected}) => {
  return test(description, (context, end) => {
    const {message} = liquiditySummary(args);

    deepEqual(message.split('\n'), expected, 'Got expected result');

    return end();
  });
});
