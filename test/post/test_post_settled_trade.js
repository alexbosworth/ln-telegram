const {deepEqual} = require('node:assert').strict;
const {rejects} = require('node:assert').strict;
const test = require('node:test');

const {nodeInfoResult} = require('./../fixtures');
const {postSettledTrade} = require('./../../');

const buyerKey = Buffer.alloc(33, 4).toString('hex');
const key = Buffer.alloc(33, 2).toString('hex');
const otherKey = Buffer.alloc(33, 3).toString('hex');

const makeApi = ({}) => {
  const messages = [];

  return {
    messages,
    sendMessage: async (user, text, options) => {
      return messages.push({options, user, text: text.split('\n')});
    },
  };
};

const makeArgs = overrides => {
  const args = {
    api: makeApi({}),
    description: 'description',
    destination: key,
    lnd: {default: {getNodeInfo: ({}, cbk) => cbk(null, nodeInfoResult)}},
    nodes: [{from: 'node1', public_key: key}],
    to: buyerKey,
    tokens: 1,
    user: 1,
  };

  Object.keys(overrides).forEach(k => args[k] = overrides[k]);

  return args;
};

const tests = [
  {
    args: makeArgs({api: undefined}),
    description: 'A Telegram API object is expected',
    error: [400, 'ExpectedTelegramApiObjectToPostSettledTrade'],
  },
  {
    args: makeArgs({description: undefined}),
    description: 'A trade description is expected',
    error: [400, 'ExpectedTradeDescriptionToPostSettledTrade'],
  },
  {
    args: makeArgs({destination: undefined}),
    description: 'A trade destination public key is expected',
    error: [400, 'ExpectedDestinationPublicKeyToPostSettledTrade'],
  },
  {
    args: makeArgs({lnd: undefined}),
    description: 'LND is expected',
    error: [400, 'ExpectedAuthenticatedLndToPostSettledTrade'],
  },
  {
    args: makeArgs({nodes: undefined}),
    description: 'An array of nodes is expected',
    error: [400, 'ExpectedArrayOfNodesToPostSettledTrade'],
  },
  {
    args: makeArgs({tokens: undefined}),
    description: 'A trade price is expected',
    error: [400, 'ExpectedTradePriceTokensToPostSettledTrade'],
  },
  {
    args: makeArgs({user: undefined}),
    description: 'A connected user id is expected',
    error: [400, 'ExpectedConnectedUserIdToPostSettledTrade'],
  },
  {
    args: makeArgs({to: undefined}),
    description: 'The public key of the buyer is expected',
    error: [400, 'ExpectedPublicKeyToGetNodeAliasFor'],
  },
  {
    args: makeArgs({}),
    description: 'A settled trade is posted',
    expected: {
      messages: [{
        options: {parse_mode: 'MarkdownV2'},
        text: [
          '😎 Sold: 0\\.00000001 “description”',
          `to alias \`${buyerKey}\``,
        ],
        user: 1,
      }],
    },
  },
  {
    args: makeArgs({
      description: '',
      lnd: {default: {getNodeInfo: ({}, cbk) => cbk('err')}},
      nodes: [
        {from: 'node2', public_key: otherKey},
        {from: 'node1', public_key: key},
      ],
    }),
    description: 'A settled trade is posted with the node it was sold from',
    expected: {
      messages: [{
        options: {parse_mode: 'MarkdownV2'},
        text: [
          '😎 Sold: 0\\.00000001 ',
          `to \`${buyerKey}\``,
          'node1',
        ],
        user: 1,
      }],
    },
  },
];

tests.forEach(({args, description, error, expected}) => {
  return test(description, async () => {
    if (!!error) {
      await rejects(postSettledTrade(args), error, 'Got expected error');
    } else {
      await postSettledTrade(args);

      deepEqual(args.api.messages, expected.messages, 'Got expected message');
    }

    return;
  });
});
