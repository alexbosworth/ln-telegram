const {test} = require('@alexbosworth/tap');

const {chanInfoResponse} = require('./../fixtures');
const {listChannelsResponse} = require('./../fixtures');
const {getNodeInfoResponse} = require('./../fixtures');
const {pendingChannelsResponse} = require('./../fixtures');
const postOpeningMessage = require('./../../post/post_opening_message');

const pubKey = '000000000000000000000000000000000000000000000000000000000000000000';

const makeArgs = (overrides => {
  const args = {
    from: 'node1',
    id: 1,
    lnd: {
      default: {
        getChanInfo: ({}, cbk) => cbk(null, chanInfoResponse),
        getNodeInfo: ({}, cbk) => cbk(null, getNodeInfoResponse),
        listChannels: ({}, cbk) => cbk(null, listChannelsResponse),
        pendingChannels: ({}, cbk) => cbk(null, pendingChannelsResponse),
      },
    },
    opening: [{
      capacity: 1,
      is_partner_initiated: true,
      partner_public_key: pubKey,
    }],
    send: ({}) => new Promise(resolve => resolve()),
  };

  Object.keys(overrides).forEach(key => args[key] = overrides[key]);

  return args;
});

const tests = [
  {
    args: makeArgs({from: ''}),
    description: 'A from node name is expected',
    error: [400, 'ExpectedFromNameToPostChannelOpeningMessage'],
  },
  {
    args: makeArgs({id: ''}),
    description: 'A connected user id is expected',
    error: [400, 'ExpectedUserIdToPostChannelOpeningMessage'],
  },
  {
    args: makeArgs({lnd: undefined}),
    description: 'An LND object is expected',
    error: [400, 'ExpectedLndToPostChannelOpeningMessage'],
  },
  {
    args: makeArgs({opening: undefined}),
    description: 'Opening channels is expected',
    error: [400, 'ExpectedOpeningChannelsToPostChannelOpening'],
  },
  {
    args: makeArgs({send: undefined}),
    description: 'A send function is expected',
    error: [400, 'ExpectedSendFunctionToPostChanOpeningMessage'],
  },
  {
    args: makeArgs({}),
    description: 'Post channel accepting message to Telegram',
    expected: {
      text: [
        '⏳ Accepting new 0\\.00000001 channel from alias `000000000000000000000000000000000000000000000000000000000000000000`\\.',
        '_node1_',
      ],
    },
  },
  {
    args: makeArgs({
      opening: [{
        capacity: 1,
        is_partner_initiated: false,
        partner_public_key: pubKey,
      }],
    }),
    description: 'Post channel opening message to Telegram',
    expected: {
      text: [
        '⏳ Opening new 0\\.00000001 channel to alias `000000000000000000000000000000000000000000000000000000000000000000`\\.',
        '_node1_',
      ],
    },
  },
];

tests.forEach(({args, description, error, expected}) => {
  return test(description, async ({end, rejects, strictSame}) => {
    if (!!error) {
      await rejects(postOpeningMessage(args), error, 'Got expected error');
    } else {
      const {text} = await postOpeningMessage(args);

      strictSame(text.split('\n'), expected.text, 'Got expected open message');
    }

    return end();
  });
});
