const {deepEqual} = require('node:assert').strict;
const test = require('node:test');

const {settleTradeMessage} = require('./../../messages');

const buyerKey = Buffer.alloc(33, 4).toString('hex');

const makeArgs = overrides => {
  const args = {
    alias: 'alias',
    description: 'description',
    to: buyerKey,
    tokens: 1,
  };

  Object.keys(overrides).forEach(k => args[k] = overrides[k]);

  return args;
};

const tests = [
  {
    args: makeArgs({}),
    description: 'A settled trade message is mapped',
    expected: {
      markup: undefined,
      mode: 'MarkdownV2',
      text: [
        '😎 Sold: 0\\.00000001 “description”',
        `to alias \`${buyerKey}\``,
      ].join('\n'),
    },
  },
  {
    args: makeArgs({from: 'node-1'}),
    description: 'A settled trade message shows the node it is from',
    expected: {
      markup: undefined,
      mode: 'MarkdownV2',
      text: [
        '😎 Sold: 0\\.00000001 “description”',
        `to alias \`${buyerKey}\``,
        'node\\-1',
      ].join('\n'),
    },
  },
  {
    args: makeArgs({alias: '', description: 'secret.txt'}),
    description: 'A settled trade message shows the key of a buyer without alias',
    expected: {
      markup: undefined,
      mode: 'MarkdownV2',
      text: [
        '😎 Sold: 0\\.00000001 “secret\\.txt”',
        `to \`${buyerKey}\``,
      ].join('\n'),
    },
  },
  {
    args: makeArgs({alias: 'buyer_alias', description: '', tokens: 100}),
    description: 'A settled trade message without a description is mapped',
    expected: {
      markup: undefined,
      mode: 'MarkdownV2',
      text: [
        '😎 Sold: 0\\.00000100 ',
        `to buyer\\_alias \`${buyerKey}\``,
      ].join('\n'),
    },
  },
];

tests.forEach(({args, description, expected}) => {
  return test(description, (context, end) => {
    const res = settleTradeMessage(args);

    deepEqual(res, expected, 'Got expected result');

    return end();
  });
});
