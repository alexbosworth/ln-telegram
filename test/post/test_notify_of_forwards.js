const {test} = require('@alexbosworth/tap');

const {chanInfoResult} = require('./../fixtures');
const {getInfoResponse} = require('./../fixtures');
const {nodeInfoResult} = require('./../fixtures');
const {versionInfo} = require('./../fixtures');
const {notifyOfForwards} = require('./../../');

const makeArgs = overrides => {
  const args = {
    forwards: [],
    from: 'from',
    id: 1,
    lnd: {},
    node: Buffer.alloc(33).toString('hex'),
    send: ({}) => new Promise(resolve => resolve()),
  };

  Object.keys(overrides).forEach(k => args[k] = overrides[k]);

  return args;
};

const getInfoRes = () => JSON.parse(JSON.stringify(getInfoResponse));

const tests = [
  {
    args: makeArgs({forwards: undefined}),
    description: 'A forwards array is required to notify of forwards',
    error: [400, 'ExpectedForwardsArrayToNotifyOfForwards'],
  },
  {
    args: makeArgs({from: undefined}),
    description: 'A from name is required to notify of forwards',
    error: [400, 'ExpectedFromNodeNameToNotifyOfForwards'],
  },
  {
    args: makeArgs({id: undefined}),
    description: 'A user id is required to notify of forwards',
    error: [400, 'ExpectedConnectedUserIdToNotifyOfForwards'],
  },
  {
    args: makeArgs({lnd: undefined}),
    description: 'An lnd connection is required to notify of forwards',
    error: [400, 'ExpectedLndToNotifyOfForwards'],
  },
  {
    args: makeArgs({node: undefined}),
    description: 'A node public key is required to notify of forwards',
    error: [400, 'ExpectedFromNodePublicKeyToNotifyOfForwards'],
  },
  {
    args: makeArgs({send: undefined}),
    description: 'A send function is required to notify of forwards',
    error: [400, 'ExpectedSendFunctionToNotifyOfForwards'],
  },
  {
    args: makeArgs({}),
    description: 'No forwards yields no notifications',
  },
  {
    args: makeArgs({
      forwards: [{
        fee: 1, 
        incoming_channel: '0x0x1',
        outgoing_channel: '1x1x1',
        tokens: 1,
      }],
      lnd: {
        default: {
          getChanInfo: (args, cbk) => cbk(null, chanInfoResult),
          getInfo: ({}, cbk) => cbk(null, getInfoRes()),
          getNodeInfo: ({}, cbk) => cbk(null, nodeInfoResult),
        },
        version: {
          getVersion: ({}, cbk) => cbk(null, versionInfo),
        },
      },
    }),
    description: 'A forward is mapped to a forward notification',
    expected: '💰 Forwarded 0\\.00000001 alias *→* alias\\. Earned 0\\.00000001 100\\.00% \\(1000000\\) \\- from',
  },
  {
    args: makeArgs({
      forwards: [{
        fee: 1,
        incoming_channel: '0x0x1',
        outgoing_channel: '1x1x1',
        tokens: 1,
      }],
      lnd: {
        default: {
          getChanInfo: (args, cbk) => cbk('err'),
          getInfo: ({}, cbk) => cbk(null, getInfoRes()),
          getNodeInfo: ({}, cbk) => cbk(null, nodeInfoResult),
        },
        version: {
          getVersion: ({}, cbk) => cbk(null, versionInfo),
        },
      },
    }),
    description: 'Get channel error reverts back to channel ids',
    expected: '💰 Forwarded 0\\.00000001 alias *→* alias\\. Earned 0\\.00000001 100\\.00% \\(1000000\\) \\- from',
  },
  {
    args: makeArgs({
      forwards: [{
        fee: 1,
        incoming_channel: '0x0x1',
        outgoing_channel: '1x1x1',
        tokens: 1,
      }],
      lnd: {
        default: {
          getChanInfo: (args, cbk) => cbk('err'),
          getInfo: ({}, cbk) => cbk(null, getInfoRes()),
          getNodeInfo: ({}, cbk) => cbk(null, nodeInfoResult),
        },
        version: {
          getVersion: ({}, cbk) => cbk(null, versionInfo),
        },
      },
    }),
    description: 'Get channel error reverts back to channel ids',
    expected: '💰 Forwarded 0\\.00000001 alias *→* alias\\. Earned 0\\.00000001 100\\.00% \\(1000000\\) \\- from',
  },
  {
    args: makeArgs({
      forwards: [{
        fee: 1,
        incoming_channel: '0x0x1',
        outgoing_channel: '1x1x1',
        tokens: 1,
      }],
      lnd: {
        default: {
          getChanInfo: (args, cbk) => cbk(null, chanInfoResult),
          getInfo: ({}, cbk) => cbk(null, getInfoRes()),
          getNodeInfo: ({}, cbk) => cbk('err'),
        },
        version: {
          getVersion: ({}, cbk) => cbk(null, versionInfo),
        },
      },
    }),
    description: 'Get node error reverts back to channel ids',
    expected: '💰 Forwarded 0\\.00000001 alias *→* alias\\. Earned 0\\.00000001 100\\.00% \\(1000000\\) \\- from',
  },
];

tests.forEach(({args, description, error, expected}) => {
  return test(description, async ({end, equal, rejects}) => {
    if (!!error) {
      await rejects(notifyOfForwards(args), error, 'Got expected error');
    } else {
      await notifyOfForwards(Object.assign(args, {request: (args, cbk) => {
        equal(args.qs.text, expected);
        return cbk(null, {statusCode: 200});
      }}));
    }

    return end();
  });
});
