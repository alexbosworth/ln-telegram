const {test} = require('@alexbosworth/tap');

const {listChannelsResponse} = require('./../fixtures');
const {getNodeInfoResponse} = require('./../fixtures');
const getRebalanceMessage = require('./../../post/get_rebalance_message');

const makeArgs = overrides => {
  const args = {
    fee: 1,
    hops: [{public_key: Buffer.alloc(33).toString('hex')}],
    lnd: {
      default: {
        getNodeInfo: ({}, cbk) => cbk(null, getNodeInfoResponse),
        listChannels: ({}, cbk) => cbk(null, listChannelsResponse),
      },
    },
    payments: [{in_channel: '0x0x1'}],
    received: 1,
  };

  Object.keys(overrides).forEach(k => args[k] = overrides[k]);

  return args;
};

const tests = [
  {
    args: makeArgs({fee: undefined}),
    description: 'A rebalance fee tokens amount is expected',
    error: [400, 'ExpectedPaidFeeToGetRebalanceMessage'],
  },
  {
    args: makeArgs({hops: undefined}),
    description: 'Hops are expected',
    error: [400, 'ExpectedArrayOfHopsToGetRebalanceMessage'],
  },
  {
    args: makeArgs({lnd: undefined}),
    description: 'LND is expected',
    error: [400, 'ExpectedLndToGetRebalanceMessage'],
  },
  {
    args: makeArgs({payments: undefined}),
    description: 'An array of payments is expected',
    error: [400, 'ExpectedPaymentsToGetRebalanceMessage'],
  },
  {
    args: makeArgs({received: undefined}),
    description: 'A received amount is expected',
    error: [400, 'ExpectedReceivedAmountToGetRebalanceMessage'],
  },
  {
    args: makeArgs({}),
    description: 'Rebalancing results in a rebalance message',
    expected: {
      message: 'Rebalanced 0\\.00000001 out 00000000 *→* 00000000\\. Fee: 0\\.00000001 100\\.00% \\(1000000\\)',
    },
  },
  {
    args: makeArgs({hops: []}),
    description: 'Rebalancing where there are no hops',
    expected: {
      message: 'Rebalanced 0\\.00000001 out  *→* 00000000\\. Fee: 0\\.00000001 100\\.00% \\(1000000\\)',
    },
  },
  {
    args: makeArgs({payments: []}),
    description: 'Absent a payment a rebalance message is still generated',
    expected: {
      message: 'Rebalanced 0\\.00000001 out 00000000\\. Fee: 0\\.00000001 100\\.00% \\(1000000\\)',
    },
  },
  {
    args: makeArgs({payments: [{in_channel: '0x0x2'}]}),
    description: 'Absent a matching HTLC a rebalance message is still made',
    expected: {
      message: 'Rebalanced 0\\.00000001 out 00000000\\. Fee: 0\\.00000001 100\\.00% \\(1000000\\)',
    },
  },
];

tests.forEach(({args, description, error, expected}) => {
  return test(description, async ({end, equal, rejects}) => {
    if (!!error) {
      await rejects(getRebalanceMessage(args), error, 'Got expected error');
    } else {
      const {message} = await getRebalanceMessage(args);

      equal(message, expected.message, 'Got expected message');
    }

    return end();
  });
});
