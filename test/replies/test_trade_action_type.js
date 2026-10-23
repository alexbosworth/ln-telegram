const {deepEqual} = require('node:assert').strict;
const test = require('node:test');

const tradeActionType = require('./../../replies/trade_action_type');
const {key} = require('./../fixtures/encoded');
const {nodeSwapTrade: swapTrade} = require('./../fixtures/encoded');
const {nodeTrade: trade} = require('./../fixtures/encoded');
const {nodeTradeNoId: tradeWithoutId} = require('./../fixtures/encoded');

const join = lines => lines.join('\n');
const title = 'Trade-Secret: 0.00000001 “description” expires 1/1/2100';

const makeArgs = overrides => {
  const args = {
    nodes: [{public_key: key}],
    text: join([title, trade, '', 'What are you selling?']),
  };

  Object.keys(overrides).forEach(k => args[k] = overrides[k]);

  return args;
};

const tests = [
  {
    args: makeArgs({}),
    description: 'A reply to the trade description question is mapped',
    expected: {type: 'set-trade-description'},
  },
  {
    args: makeArgs({
      text: join([title, trade, '', 'Trade expiry date? (YYYY-MM-DD format)']),
    }),
    description: 'A reply to the trade expiry question is mapped',
    expected: {type: 'set-trade-expires-at'},
  },
  {
    args: makeArgs({text: undefined}),
    description: 'A message without text is not a trade action',
    expected: {},
  },
  {
    args: makeArgs({text: 'text'}),
    description: 'A message without the trade title is not a trade action',
    expected: {},
  },
  {
    args: makeArgs({text: title}),
    description: 'A trade message needs an encoded trade',
    expected: {},
  },
  {
    args: makeArgs({
      text: join([title, trade, 'spacer', 'What are you selling?']),
    }),
    description: 'A trade message needs a blank line before the question',
    expected: {},
  },
  {
    args: makeArgs({
      text: join([title, trade, '', 'What are you selling?', 'other']),
    }),
    description: 'A trade message cannot have lines after the question',
    expected: {},
  },
  {
    args: makeArgs({
      text: join([title, trade, '', 'What is this invoice for?']),
    }),
    description: 'A trade message needs a trade question',
    expected: {},
  },
  {
    args: makeArgs({
      text: join([title, 'trade', '', 'What are you selling?']),
    }),
    description: 'A trade message needs a valid encoded trade',
    expected: {},
  },
  {
    args: makeArgs({
      text: join([title, swapTrade, '', 'What are you selling?']),
    }),
    description: 'A trade message needs an open trade',
    expected: {},
  },
  {
    args: makeArgs({
      text: join([title, tradeWithoutId, '', 'What are you selling?']),
    }),
    description: 'A trade message needs an open trade with an id',
    expected: {},
  },
];

tests.forEach(({args, description, expected}) => {
  return test(description, (context, end) => {
    deepEqual(tradeActionType(args), expected, 'Got expected result');

    return end();
  });
});
