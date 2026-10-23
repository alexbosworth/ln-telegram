const {deepEqual} = require('node:assert').strict;
const {InlineKeyboard} = require('grammy');
const {Settings} = require('luxon');
const test = require('node:test');

const {createTradeMessage} = require('./../../messages');
const {testnetTrade} = require('./../fixtures/encoded');
const {trade} = require('./../fixtures/encoded');

const key = Buffer.alloc(33, 2).toString('hex');
const otherKey = Buffer.alloc(33, 3).toString('hex');

// The expiry date is shown in the default locale and zone, so pin those
Settings.defaultLocale = 'en-US';
Settings.defaultZone = 'utc';

const makeArgs = overrides => {
  const args = {
    description: 'description',
    destination: key,
    expires_at: '2026-01-01T00:00:00.000Z',
    id: Buffer.alloc(32).toString('hex'),
    network: 'btc',
    nodes: [{from: 'node1', public_key: key}],
    tokens: 1,
  };

  Object.keys(overrides).forEach(k => args[k] = overrides[k]);

  return args;
};

const tests = [
  {
    args: makeArgs({}),
    description: 'A created trade message is mapped',
    expected: {
      markup: new InlineKeyboard()
        .text('Set Description', 'set-trade-description')
        .text('Expiry...', 'set-trade-expires-at')
        .text('🗑', 'cancel-trade'),
      mode: 'MarkdownV2',
      text: [
        'Trade\\-Secret: 0\\.00000001 “description” expires 1/1/2026',
        `\`${trade}\``,
      ].join('\n'),
    },
  },
  {
    args: makeArgs({
      from: 'node-1',
      nodes: [
        {from: 'node-1', public_key: key},
        {from: 'node2', public_key: otherKey},
      ],
    }),
    description: 'A created trade message shows the node it is from',
    expected: {
      markup: new InlineKeyboard()
        .text('Set Description', 'set-trade-description')
        .text('Expiry...', 'set-trade-expires-at')
        .text('Node...', 'set-trade-node')
        .text('🗑', 'cancel-trade'),
      mode: 'MarkdownV2',
      text: [
        'Trade\\-Secret: 0\\.00000001 “description” expires 1/1/2026',
        `\`${trade}\``,
        'node\\-1',
      ].join('\n'),
    },
  },
  {
    args: makeArgs({
      description: 'secret.txt',
      expires_at: '2026-06-15T12:00:00.000Z',
      tokens: 150000,
    }),
    description: 'A created trade message escapes the description',
    expected: {
      markup: new InlineKeyboard()
        .text('Set Description', 'set-trade-description')
        .text('Expiry...', 'set-trade-expires-at')
        .text('🗑', 'cancel-trade'),
      mode: 'MarkdownV2',
      text: [
        'Trade\\-Secret: 0\\.00150000 “secret\\.txt” expires 6/15/2026',
        `\`${trade}\``,
      ].join('\n'),
    },
  },
  {
    args: makeArgs({description: '', network: 'btctestnet'}),
    description: 'A created testnet trade message without a description',
    expected: {
      markup: new InlineKeyboard()
        .text('Set Description', 'set-trade-description')
        .text('Expiry...', 'set-trade-expires-at')
        .text('🗑', 'cancel-trade'),
      mode: 'MarkdownV2',
      text: [
        'Trade\\-Secret: 0\\.00000001 expires 1/1/2026',
        `\`${testnetTrade}\``,
      ].join('\n'),
    },
  },
];

tests.forEach(({args, description, expected}) => {
  return test(description, (context, end) => {
    const res = createTradeMessage(args);

    deepEqual(res, expected, 'Got expected result');

    return end();
  });
});
