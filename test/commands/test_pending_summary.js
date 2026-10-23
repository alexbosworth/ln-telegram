const {deepEqual} = require('node:assert').strict;
const test = require('node:test');
const {throws} = require('node:assert').strict;

const pendingSummary = require('./../../commands/pending_summary');

const makeArgs = overrides => {
  const args = {
    count: 2,
    htlcs: [{
      forwarding: [{
        fee: 1,
        in_peer: Buffer.alloc(33, 2).toString('hex'),
        out_peer: Buffer.alloc(33, 3).toString('hex'),
        tokens: 2,
      }],
      from: 'from',
      nodes: [
        {alias: 'alias', id: Buffer.alloc(33, 2).toString('hex')},
        {alias: 'alias2', id: Buffer.alloc(33, 3).toString('hex')},
      ],
      sending: [{out_peer: Buffer.alloc(33, 3).toString('hex')}],
    }],
    pending: [{
      closing: [{
        partner_public_key: Buffer.alloc(33, 3).toString('hex'),
        pending_balance: 1,
        timelock_expiration: 8,
      }],
      from: 'from',
      height: 1,
      nodes: [
        {alias: 'alias', id: Buffer.alloc(33, 2).toString('hex')},
        {alias: 'alias2', id: Buffer.alloc(33, 3).toString('hex')},
      ],
      opening: [{
        is_partner_initiated: true,
        local_balance: 1,
        partner_public_key: Buffer.alloc(33, 3).toString('hex'),
        remote_balance: 2,
        transaction_fee: 3,
        transaction_id: Buffer.alloc(32).toString('hex'),
      }],
    }],
  };

  Object.keys(overrides).forEach(k => args[k] = overrides[k]);

  return args;
};

const tests = [
  {
    args: makeArgs({}),
    description: 'Pending summary is derived',
    expected: [
      '\n*from*',
      "⏳ Waiting for inbound 0\\.00000006 channel with alias2 03030303 to confirm: `0000000000000000000000000000000000000000000000000000000000000000`",
      "⏳ Waiting to recover 0\\.00000001 in 1 hour from closing channel with alias2 03030303",
      "💸 Forwarding 0\\.00000002 for 0\\.00000001 fee from alias 02020202 to alias2 03030303",
      "👽 Probing out alias2 03030303",
    ],
  },
  {
    args: makeArgs({
      count: 1,
      htlcs: [{forwarding: [], from: 'from', nodes: [], sending: []}],
      pending: [{
        closing: [],
        from: 'from',
        height: 1,
        nodes: [{alias: 'alias2', id: Buffer.alloc(33, 3).toString('hex')}],
        opening: [{
          is_partner_initiated: false,
          local_balance: 1,
          partner_public_key: Buffer.alloc(33, 3).toString('hex'),
          remote_balance: 2,
          transaction_fee: 3,
          transaction_id: Buffer.alloc(32).toString('hex'),
        }],
      }],
    }),
    description: 'Pending summary of a single node is not titled with the node',
    expected: [
      '⏳ Waiting for outbound 0\\.00000006 channel with alias2 03030303 to confirm: `0000000000000000000000000000000000000000000000000000000000000000`',
    ],
  },
  {
    args: makeArgs({
      htlcs: [{forwarding: [], from: 'from', nodes: [], sending: []}],
      pending: [{
        closing: [
          {
            partner_public_key: Buffer.alloc(33, 3).toString('hex'),
            pending_balance: 1,
            timelock_expiration: 1,
          },
          {
            partner_public_key: Buffer.alloc(33, 3).toString('hex'),
            pending_balance: 0,
            timelock_expiration: 2,
          },
        ],
        from: 'from',
        height: 1,
        nodes: [{alias: 'alias2', id: Buffer.alloc(33, 3).toString('hex')}],
        opening: [],
      }],
    }),
    description: 'Pending summary shows when nothing is pending',
    expected: ['🤖 No pending payments or channels'],
  },
];

tests.forEach(({args, description, error, expected}) => {
  return test(description, (context, end) => {
    if (!!error) {
      throws(() => pendingSummary(args), error, 'Got expected error');
    } else {
      deepEqual(pendingSummary(args), expected, 'Got expected result');
    }

    return end();
  });
});
