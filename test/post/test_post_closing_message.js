const {test} = require('@alexbosworth/tap');

const {chanInfoResponse} = require('./../fixtures');
const {getNodeInfoResponse} = require('./../fixtures');
const {postClosingMessage} = require('./../../post');

const pubKey = '000000000000000000000000000000000000000000000000000000000000000000';

const makeArgs = (overrides => {
  const args = {
    closing: [{
      capacity: 1,
      is_partner_initiated: true,
      partner_public_key: pubKey,
      transaction_id: Buffer.alloc(32).toString('hex'),
      transaction_vout: 0,
    }],
    from: 'node1',
    id: 1,
    lnd: {
      default: {
        getChanInfo: ({}, cbk) => cbk(null, chanInfoResponse),
        getNodeInfo: ({}, cbk) => cbk(null, getNodeInfoResponse),
      },
    },
    nodes: [{}],
    send: ({}) => new Promise(resolve => resolve()),
  };

  Object.keys(overrides).forEach(key => args[key] = overrides[key]);

  return args;
});

const tests = [
  {
    args: makeArgs({closing: undefined}),
    description: 'Closing channels is expected',
    error: [400, 'ExpectedClosingChannelsToPostClosingMessage'],
  },
  {
    args: makeArgs({from: ''}),
    description: 'A from node name is expected',
    error: [400, 'ExpectedFromNameToPostChannelClosingMessage'],
  },
  {
    args: makeArgs({id: ''}),
    description: 'A connected user id is expected',
    error: [400, 'ExpectedUserIdToPostChannelClosingMessage'],
  },
  {
    args: makeArgs({lnd: undefined}),
    description: 'An LND object is expected',
    error: [400, 'ExpectedLndToPostChannelClosingMessage'],
  },
  {
    args: makeArgs({nodes: undefined}),
    description: 'Nodes are expected',
    error: [400, 'ExpectedArrayOfSavedNodesToPostClosingMessage'],
  },
  {
    args: makeArgs({send: undefined}),
    description: 'A send function is expected',
    error: [400, 'ExpectedSendFunctionToPostChanClosingMessage'],
  },
  {
    args: makeArgs({}),
    description: 'Post channel closing message to Telegram',
    expected: {
      text: [
        '⏳ Closing 0\\.00000001 channel with alias 000000000000000000000000000000000000000000000000000000000000000000',
        '*Funding Outpoint:* `0000000000000000000000000000000000000000000000000000000000000000:0`',
      ],
    },
  },
  {
    args: makeArgs({nodes: [{}, {}]}),
    description: 'Post closing message when there are multiple nodes',
    expected: {
      text: [
        '⏳ Closing 0\\.00000001 channel with alias 000000000000000000000000000000000000000000000000000000000000000000',
        '*Funding Outpoint:* `0000000000000000000000000000000000000000000000000000000000000000:0`',
        '_node1_',
      ],
    },
  },
];

tests.forEach(({args, description, error, expected}) => {
  return test(description, async ({end, rejects, strictSame}) => {
    if (!!error) {
      await rejects(postClosingMessage(args), error, 'Got expected error');
    } else {
      const text = await postClosingMessage(args);

      strictSame(text.split('\n'), expected.text, 'Got expected message');
    }

    return end();
  });
});
