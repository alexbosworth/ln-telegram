const {test} = require('tap');

const {chanInfoResult} = require('./../fixtures');
const {getInfoResponse} = require('./../fixtures');
const {nodeInfoResult} = require('./../fixtures');
const {notifyOfForwards} = require('./../../');

const makeArgs = overrides => {
  const args = {
    forwards: [],
    from: 'from',
    id: 1,
    key: 'key',
    lnd: {},
    node: Buffer.alloc(33).toString('hex'),
    request: ({}, cbk) => {},
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
    args: makeArgs({key: undefined}),
    description: 'A telegram key is required to notify of forwards',
    error: [400, 'ExpectedTelegramApiKeyToNotifyOfForwards'],
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
    args: makeArgs({request: undefined}),
    description: 'A request function is required to notify of forwards',
    error: [400, 'ExpectedRequestFunctionToNotifyOfForwards'],
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
      },
      request: ({qs}, cbk) => {
        if (qs.text !== '💰 *from*\nEarned 1 forwarding 1 from alias to alias') {
          throw new Error('UnexpectedTextMessageSentToTelegramRequest');
        }

        return cbk(null, {statusCode: 200})
      },
    }),
    description: 'A forward is mapped to a forward notification',
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
      },
      request: ({qs}, cbk) => {
        if (qs.text !== '💰 *from*\nEarned 1 forwarding 1 from 0x0x1 to 1x1x1') {
          throw new Error('UnexpectedTextMessageSentToTelegramRequest');
        }

        return cbk(null, {statusCode: 200})
      },
    }),
    description: 'Get channel error reverts back to channel ids',
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
      },
      request: ({qs}, cbk) => {
        if (qs.text !== '💰 *from*\nEarned 1 forwarding 1 from 0x0x1 to 1x1x1') {
          throw new Error('UnexpectedTextMessageSentToTelegramRequest');
        }

        return cbk(null, {statusCode: 200})
      },
    }),
    description: 'Get channel error reverts back to channel ids',
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
      },
      request: ({qs}, cbk) => {
        if (qs.text !== '💰 *from*\nEarned 1 forwarding 1 from 0x0x1 to 1x1x1') {
          throw new Error('UnexpectedTextMessageSentToTelegramRequest');
        }

        return cbk(null, {statusCode: 200})
      },
    }),
    description: 'Get node error reverts back to channel ids',
  },
];

tests.forEach(({args, description, error, expected}) => {
  return test(description, async ({end, equal, rejects}) => {
    if (!!error) {
      await rejects(notifyOfForwards(args), error, 'Got expected error');
    } else {
      await notifyOfForwards(args);
    }

    return end();
  });
});
