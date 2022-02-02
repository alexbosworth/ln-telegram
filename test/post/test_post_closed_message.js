const {test} = require('@alexbosworth/tap');

const {chanInfoResponse} = require('./../fixtures');
const {listChannelsResponse} = require('./../fixtures');
const {getNodeInfoResponse} = require('./../fixtures');
const {pendingChannelsResponse} = require('./../fixtures');
const postClosedMessage = require('./../../post/post_closed_message');

const pubKey = '000000000000000000000000000000000000000000000000000000000000000000';

const makeArgs = (overrides => {
  const args = {
    capacity: 1,
    from: 'node1',
    id: 1,
    is_breach_close: false,
    is_cooperative_close: false,
    is_local_force_close: false,
    is_remote_force_close: false,
    lnd: {
      default: {
        getChanInfo: ({}, cbk) => cbk(null, chanInfoResponse),
        getNodeInfo: ({}, cbk) => cbk(null, getNodeInfoResponse),
        listChannels: ({}, cbk) => cbk(null, listChannelsResponse),
        pendingChannels: ({}, cbk) => cbk(null, pendingChannelsResponse),
      },
    },
    partner_public_key: pubKey,
    send: ({}) => new Promise(resolve => resolve()),
  };

  Object.keys(overrides).forEach(key => args[key] = overrides[key]);

  return args;
});

const tests = [
  {
    args: makeArgs({capacity: undefined}),
    description: 'Capacity is required',
    error: [400, 'ExpectedChannelCapacityToPostClosedMessage'],
  },
  {
    args: makeArgs({from: ''}),
    description: 'From node name is required',
    error: [400, 'ExpectedFromNodeToPostClosedMessage'],
  },
  {
    args: makeArgs({id: ''}),
    description: 'Connected user id is required',
    error: [400, 'ExpectedConnectedUserIdToPostClosedMessage'],
  },
  {
    args: makeArgs({is_breach_close: undefined}),
    description: 'Breach close status is required',
    error: [400, 'ExpectedBreachCloseBoolToPostClosedMessage'],
  },
  {
    args: makeArgs({is_cooperative_close: undefined}),
    description: 'Cooperative close status is required',
    error: [400, 'ExpectedCooperativeCloseBoolToPostClosedMessage'],
  },
  {
    args: makeArgs({is_local_force_close: undefined}),
    description: 'Local force close status is required',
    error: [400, 'ExpectedLocalForceCloseStatusToPostCloseMessage'],
  },
  {
    args: makeArgs({is_remote_force_close: undefined}),
    description: 'Remote force close status is required',
    error: [400, 'ExpectedRemoteForceCloseToPostCloseMessage'],
  },
  {
    args: makeArgs({lnd: undefined}),
    description: 'LND object is required',
    error: [400, 'ExpectedAuthenticatedLndToPostCloseMessage'],
  },
  {
    args: makeArgs({partner_public_key: undefined}),
    description: 'Partner public key is required',
    error: [400, 'ExpectedPartnerPublicKeyToPostCloseMessage'],
  },
  {
    args: makeArgs({send: undefined}),
    description: 'A send function is required',
    error: [400, 'ExpectedSendFunctionToPostCloseMessage'],
  },
  {
    args: makeArgs({}),
    description: 'Post channel close message to Telegram',
    expected: {
      text: [
        `🥀 0.00000001 channel closed with alias ${pubKey}. Inbound liquidity now: 0.00000001. Outbound liquidity now: 0.00000001.`,
        'node1',
      ],
    },
  },
  {
    args: makeArgs({is_breach_close: true}),
    description: 'Post breach channel close message to Telegram',
    expected: {
      text: [
        `🥀 Breach countered on 0.00000001 channel with alias ${pubKey}. Inbound liquidity now: 0.00000001. Outbound liquidity now: 0.00000001.`,
        'node1',
      ],
    },
  },
  {
    args: makeArgs({is_cooperative_close: true}),
    description: 'Post cooperative channel close message to Telegram',
    expected: {
      text: [
        `🥀 Cooperatively closed 0.00000001 channel with alias ${pubKey}. Inbound liquidity now: 0.00000001. Outbound liquidity now: 0.00000001.`,
        'node1',
      ],
    },
  },
  {
    args: makeArgs({is_local_force_close: true}),
    description: 'Post local force channel close message to Telegram',
    expected: {
      text: [
        `🥀 Force-closed 0.00000001 channel with alias ${pubKey}. Inbound liquidity now: 0.00000001. Outbound liquidity now: 0.00000001.`,
        'node1',
      ],
    },
  },
  {
    args: makeArgs({is_remote_force_close: true}),
    description: 'Post remote force channel close message to Telegram',
    expected: {
      text: [
        `🥀 0.00000001 channel was force closed by alias ${pubKey}. Inbound liquidity now: 0.00000001. Outbound liquidity now: 0.00000001.`,
        'node1',
      ],
    },
  },
];

tests.forEach(({args, description, error, expected}) => {
  return test(description, async ({end, rejects, strictSame}) => {
    if (!!error) {
      rejects(postClosedMessage(args), error, 'Got expected error');
    } else {
      const {text} = await postClosedMessage(args);

      strictSame(text.split('\n'), expected.text, 'Got close message');
    }

    return end();
  });
});
