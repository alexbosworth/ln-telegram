const {deepEqual} = require('node:assert').strict;
const {InlineKeyboard} = require('grammy');
const {rejects} = require('node:assert').strict;
const {Settings} = require('luxon');
const test = require('node:test');

const {getInfoResponse} = require('./../fixtures');
const {postCreatedTrade} = require('./../../');
const {trade} = require('./../fixtures/encoded');

const getInfoRes = () => JSON.parse(JSON.stringify(getInfoResponse));
const key = Buffer.alloc(33, 2).toString('hex');
const otherKey = Buffer.alloc(33, 3).toString('hex');

// The expiry date is shown in the default locale and zone, so pin those
Settings.defaultLocale = 'en-US';
Settings.defaultZone = 'utc';

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
    expires_at: '2026-01-01T00:00:00.000Z',
    id: Buffer.alloc(32).toString('hex'),
    lnd: {default: {getInfo: ({}, cbk) => cbk(null, getInfoRes())}},
    nodes: [{from: 'node1', public_key: key}],
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
    error: [400, 'ExpectedTelegramApiObjectToPostCreatedTrade'],
  },
  {
    args: makeArgs({description: undefined}),
    description: 'A trade description is expected',
    error: [400, 'ExpectedTradeDescriptionToPostCreatedTrade'],
  },
  {
    args: makeArgs({destination: undefined}),
    description: 'A trade destination public key is expected',
    error: [400, 'ExpectedDestinationPublicKeyToPostCreatedTrade'],
  },
  {
    args: makeArgs({expires_at: undefined}),
    description: 'A trade expiry date is expected',
    error: [400, 'ExpectedTradeExpiryToPostCreatedTrade'],
  },
  {
    args: makeArgs({id: undefined}),
    description: 'A trade id is expected',
    error: [400, 'ExpectedTradeIdToPostCreatedTrade'],
  },
  {
    args: makeArgs({lnd: undefined}),
    description: 'LND is expected',
    error: [400, 'ExpectedAuthenticatedLndToPostCreatedTrade'],
  },
  {
    args: makeArgs({nodes: undefined}),
    description: 'An array of nodes is expected',
    error: [400, 'ExpectedArrayOfNodesToPostCreatedTrade'],
  },
  {
    args: makeArgs({tokens: undefined}),
    description: 'A trade price is expected',
    error: [400, 'ExpectedTradePriceTokensToPostCreatedTrade'],
  },
  {
    args: makeArgs({user: undefined}),
    description: 'A connected user id is expected',
    error: [400, 'ExpectedConnectedUserIdToPostCreatedTrade'],
  },
  {
    args: makeArgs({lnd: {default: {getInfo: ({}, cbk) => cbk('err')}}}),
    description: 'An error getting the network is passed back',
    error: [503, 'GetWalletInfoErr', {err: 'err'}],
  },
  {
    args: makeArgs({}),
    description: 'A created trade is posted',
    expected: {
      messages: [{
        options: {
          parse_mode: 'MarkdownV2',
          reply_markup: new InlineKeyboard()
            .text('Set Description', 'set-trade-description')
            .text('Expiry...', 'set-trade-expires-at')
            .text('🗑', 'cancel-trade'),
        },
        text: [
          'Trade\\-Secret: 0\\.00000001 “description” expires 1/1/2026',
          `\`${trade}\``,
        ],
        user: 1,
      }],
    },
  },
  {
    args: makeArgs({
      description: '',
      nodes: [
        {from: 'node2', public_key: otherKey},
        {from: 'node1', public_key: key},
      ],
    }),
    description: 'A created trade is posted with the node it was created on',
    expected: {
      messages: [{
        options: {
          parse_mode: 'MarkdownV2',
          reply_markup: new InlineKeyboard()
            .text('Set Description', 'set-trade-description')
            .text('Expiry...', 'set-trade-expires-at')
            .text('Node...', 'set-trade-node')
            .text('🗑', 'cancel-trade'),
        },
        text: [
          'Trade\\-Secret: 0\\.00000001 expires 1/1/2026',
          `\`${trade}\``,
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
      await rejects(postCreatedTrade(args), error, 'Got expected error');
    } else {
      await postCreatedTrade(args);

      deepEqual(args.api.messages, expected.messages, 'Got expected message');
    }

    return;
  });
});
