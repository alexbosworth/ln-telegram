const {test} = require('@alexbosworth/tap');

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
      ' Inbound   0.00000001 ',
      ' Outbound  0.00000002 ',
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
      ' Inbound   -          ',
      ' Outbound  0.00000001 ',
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
      ' Inbound   0.00000001 ',
      ' Outbound  -          ',
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
      ' Inbound   0.00000001 ',
      ' Outbound  0.00000002 ',
      '',
      '```_🌊 more_:',
      '```',
      ' Inbound   0.00000001 ',
      ' Outbound  0.00000002 ',
      '',
      '```',
    ],
  },
];

tests.forEach(({args, description, error, expected}) => {
  return test(description, async ({end, rejects, strictSame}) => {
    const {message} = liquiditySummary(args);

    strictSame(message.split('\n'), expected, 'Got expected result');

    return end();
  });
});
