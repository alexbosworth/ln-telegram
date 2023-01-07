const {test} = require('@alexbosworth/tap');

const {nodeInfoResult} = require('./../fixtures');
const {postSettledPayment} = require('./../../');

const makeArgs = overrides => {
  const args = {
    from: 'from',
    id: 1,
    lnd: {default: {getNodeInfo: ({}, cbk) => cbk(null, nodeInfoResult)}},
    nodes: [Buffer.alloc(33, 2).toString('hex')],
    payment: {
      destination: Buffer.alloc(33, 3).toString('hex'),
      id: Buffer.alloc(32).toString('hex'),
      paths: [{hops: [{public_key: Buffer.alloc(33, 2).toString('hex')}]}],
      safe_fee: 1,
      safe_tokens: 2,
    },
    send: ({}) => new Promise(resolve => resolve()),
  };

  Object.keys(overrides).forEach(k => args[k] = overrides[k]);

  return args;
};

const getInfoRes = () => JSON.parse(JSON.stringify(getInfoResponse));

const tests = [
  {
    args: makeArgs({from: undefined}),
    description: 'A from name is required to notify of payment',
    error: [400, 'ExpectedPaymentFromNameStringToPostPayment'],
  },
  {
    args: makeArgs({id: undefined}),
    description: 'A user id is required to notify of payment',
    error: [400, 'ExpectedUserIdToPostSettledPayment'],
  },
  {
    args: makeArgs({lnd: undefined}),
    description: 'An lnd connection is required to notify of payment',
    error: [400, 'ExpectedLndToPostSettledPayment'],
  },
  {
    args: makeArgs({nodes: undefined}),
    description: 'Nodes are required to notify of a payment',
    error: [400, 'ExpectedArrayOfNodesToPostSettledPayment'],
  },
  {
    args: makeArgs({payment: undefined}),
    description: 'Payment details are required to notify of a payment',
    error: [400, 'ExpectedPaymentToPostSettledPayment'],
  },
  {
    args: makeArgs({send: undefined}),
    description: 'A send function is required to notify of forwards',
    error: [400, 'ExpectedSendFunctionToPostSettledPayment'],
  },
  {
    args: makeArgs({}),
    description: 'A payment notification is posted',
    expected: '⚡️ Sent 0\\.00000001 to alias out alias\\. Paid routing fee: 0\\.00000001 \\- _from_',
  },
  {
    args: makeArgs({
      lnd: {default: {getNodeInfo: ({}, cbk) => cbk('err')}},
      nodes: [Buffer.alloc(33, 3).toString('hex')],
      payment: {
        destination: Buffer.alloc(33, 3).toString('hex'),
        id: Buffer.alloc(32).toString('hex'),
        paths: [{hops: [{public_key: Buffer.alloc(33, 2).toString('hex')}]}],
        safe_fee: 0,
        safe_tokens: 2,
      },
    }),
    description: 'A transfer notification is posted',
    expected: '⚡️ Transferred 0\\.00000002 to 03030303 out 02020202 \\- _from_',
  },
];

tests.forEach(({args, description, error, expected}) => {
  return test(description, async ({end, equal, rejects, strictSame}) => {
    if (!!error) {
      await rejects(postSettledPayment(args), error, 'Got expected error');
    } else {
      const res = await postSettledPayment(args);

      strictSame(res, expected, 'Got expected result');
    }

    return end();
  });
});
