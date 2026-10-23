const {deepEqual} = require('node:assert').strict;
const test = require('node:test');
const {throws} = require('node:assert').strict;

const pendingPayments = require('./../../commands/pending_payments');

const makeArgs = overrides => {
  const args = {
    channels: [
      {
        id: '1x1x1',
        partner_public_key: Buffer.alloc(33, 3).toString('hex'),
        pending_payments: [{
          id: Buffer.alloc(32).toString('hex'),
          in_channel: '2x2x2',
          in_payment: 1,
          is_forward: true,
          is_outgoing: true,
          payment: 2,
          timeout: 1,
          tokens: 1,
        }],
      },
      {
        id: '2x2x2',
        partner_public_key: Buffer.alloc(33, 2).toString('hex'),
        pending_payments: [{
          id: Buffer.alloc(32).toString('hex'),
          is_forward: true,
          is_outgoing: false,
          out_channel: '1x1x1',
          out_payment: 2,
          payment: 1,
          timeout: 1,
          tokens: 2,
        }],
      },
    ],
  };

  Object.keys(overrides).forEach(k => args[k] = overrides[k]);

  return args;
};

const tests = [
  {
    args: makeArgs({}),
    description: 'Pending payments derives payments from channels',
    expected: {
      forwarding: [{
        fee: 1,
        in_peer: '020202020202020202020202020202020202020202020202020202020202020202',
        out_peer: '030303030303030303030303030303030303030303030303030303030303030303',
        payment: '0000000000000000000000000000000000000000000000000000000000000000',
        timeout: 1,
        tokens: 1,
      }],
      sending: [],
    },
  },
  {
    args: makeArgs({
      channels: [
        {
          id: '1x1x1',
          partner_public_key: Buffer.alloc(33, 3).toString('hex'),
          pending_payments: [
            {
              id: Buffer.alloc(32).toString('hex'),
              is_outgoing: true,
              timeout: 1,
              tokens: 1,
            },
            {
              id: Buffer.alloc(32, 1).toString('hex'),
              is_outgoing: false,
              timeout: 2,
              tokens: 2,
            },
          ],
        },
        {
          id: '2x2x2',
          partner_public_key: Buffer.alloc(33, 2).toString('hex'),
        },
      ],
    }),
    description: 'Pending payments derives payments being sent out',
    expected: {
      forwarding: [],
      sending: [{
        out_channel: '1x1x1',
        out_peer: '030303030303030303030303030303030303030303030303030303030303030303',
        timeout: 1,
        tokens: 1,
      }],
    },
  },
  {
    args: makeArgs({
      channels: [{
        id: '1x1x1',
        partner_public_key: Buffer.alloc(33, 3).toString('hex'),
        pending_payments: [
          {
            id: Buffer.alloc(32).toString('hex'),
            in_payment: 1,
            is_forward: true,
            is_outgoing: true,
            payment: 2,
            timeout: 1,
            tokens: 1,
          },
          {
            id: Buffer.alloc(32).toString('hex'),
            in_channel: '2x2x2',
            is_forward: true,
            is_outgoing: true,
            payment: 3,
            timeout: 1,
            tokens: 1,
          },
        ],
      }],
    }),
    description: 'Forwards without channel and payment references are skipped',
    expected: {forwarding: [], sending: []},
  },
  {
    args: makeArgs({
      channels: [{
        id: '1x1x1',
        partner_public_key: Buffer.alloc(33, 3).toString('hex'),
        pending_payments: [{
          id: Buffer.alloc(32).toString('hex'),
          in_channel: '2x2x2',
          in_payment: 1,
          is_forward: true,
          is_outgoing: true,
          payment: 2,
          timeout: 1,
          tokens: 1,
        }],
      }],
    }),
    description: 'Forwards in from an unknown channel are skipped',
    expected: {forwarding: [], sending: []},
  },
  {
    args: makeArgs({
      channels: [
        {
          id: '1x1x1',
          partner_public_key: Buffer.alloc(33, 3).toString('hex'),
          pending_payments: [{
            id: Buffer.alloc(32).toString('hex'),
            in_channel: '2x2x2',
            in_payment: 1,
            is_forward: true,
            is_outgoing: true,
            payment: 2,
            timeout: 1,
            tokens: 1,
          }],
        },
        {
          id: '2x2x2',
          partner_public_key: Buffer.alloc(33, 2).toString('hex'),
          pending_payments: [],
        },
      ],
    }),
    description: 'Forwards in from an unknown payment are skipped',
    expected: {forwarding: [], sending: []},
  },
];

tests.forEach(({args, description, error, expected}) => {
  return test(description, (context, end) => {
    if (!!error) {
      throws(() => pendingPayments(args), error, 'Got expected error');
    } else {
      deepEqual(pendingPayments(args), expected, 'Got expected result');
    }

    return end();
  });
});
