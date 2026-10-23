const {deepEqual} = require('node:assert').strict;
const {rejects} = require('node:assert').strict;
const test = require('node:test');

const {nodeInfoResult} = require('./../fixtures');
const method = require('./../../post/get_balanced_open_message');

const pubKey = Buffer.alloc(33, 3).toString('hex');

const makeArgs = overrides => {
  const args = {
    capacity: 1,
    from: pubKey,
    lnd: {default: {getNodeInfo: ({}, cbk) => cbk(null, nodeInfoResult)}},
    rate: 1,
  };

  Object.keys(overrides).forEach(k => args[k] = overrides[k]);

  return args;
};

const tests = [
  {
    args: makeArgs({capacity: undefined}),
    description: 'A proposed channel capacity is expected',
    error: [400, 'ExpectedBalancedProposalCapacityToGetMessage'],
  },
  {
    args: makeArgs({from: undefined}),
    description: 'The public key of the proposing node is expected',
    error: [400, 'ExpectedProposalFromPublicKeyToGetMessage'],
  },
  {
    args: makeArgs({lnd: undefined}),
    description: 'LND is expected',
    error: [400, 'ExpectedLndToGetBalancedOpenMessage'],
  },
  {
    args: makeArgs({rate: undefined}),
    description: 'A proposed chain fee rate is expected',
    error: [400, 'ExpectedFeeRateToGetBalancedOpenMessage'],
  },
  {
    args: makeArgs({}),
    description: 'A balanced open proposal message is returned',
    expected: {
      icon: '⚖️',
      message: [
        'Received a 0\\.00000001 balanced channel open proposal from alias',
        `\`${pubKey}\``,
        'Proposed chain fee rate: 1/vbyte',
      ].join('\n'),
    },
  },
  {
    args: makeArgs({
      capacity: 1000000,
      lnd: {default: {getNodeInfo: ({}, cbk) => cbk('err')}},
      rate: 2,
    }),
    description: 'A proposal from a node without an alias shows the short key',
    expected: {
      icon: '⚖️',
      message: [
        'Received a 0\\.01000000 balanced channel open proposal from 03030303',
        `\`${pubKey}\``,
        'Proposed chain fee rate: 2/vbyte',
      ].join('\n'),
    },
  },
];

tests.forEach(({args, description, error, expected}) => {
  return test(description, async () => {
    if (!!error) {
      await rejects(method(args), error, 'Got expected error');
    } else {
      const res = await method(args);

      deepEqual(res, expected, 'Got expected result');
    }

    return;
  });
});
