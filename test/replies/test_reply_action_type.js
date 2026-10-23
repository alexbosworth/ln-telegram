const {deepEqual} = require('node:assert').strict;
const test = require('node:test');

const replyActionType = require('./../../replies/reply_action_type');
const {key} = require('./../fixtures/encoded');
const {request} = require('./../fixtures/encoded');
const {nodeTrade: trade} = require('./../fixtures/encoded');

const invoiceTitle = 'Invoice: 0.00000001 “description”';
const join = lines => lines.join('\n');
const tradeTitle = 'Trade-Secret: 0.00000001 “description” expires 1/1/2100';

const makeArgs = overrides => {
  const args = {
    nodes: [{public_key: key}],
    text: join([invoiceTitle, request, '', 'What is this invoice for?']),
  };

  Object.keys(overrides).forEach(k => args[k] = overrides[k]);

  return args;
};

const tests = [
  {
    args: makeArgs({}),
    description: 'A reply to the invoice description question is mapped',
    expected: {type: 'set-invoice-description'},
  },
  {
    args: makeArgs({
      text: join([
        invoiceTitle,
        request,
        '',
        'How much should this invoice be for?',
      ]),
    }),
    description: 'A reply to the invoice amount question is mapped',
    expected: {type: 'set-invoice-tokens'},
  },
  {
    args: makeArgs({
      text: join([tradeTitle, trade, '', 'What are you selling?']),
    }),
    description: 'A reply to the trade description question is mapped',
    expected: {type: 'set-trade-description'},
  },
  {
    args: makeArgs({
      text: join([
        tradeTitle,
        trade,
        '',
        'Trade expiry date? (YYYY-MM-DD format)',
      ]),
    }),
    description: 'A reply to the trade expiry question is mapped',
    expected: {type: 'set-trade-expires-at'},
  },
  {
    args: makeArgs({text: 'text'}),
    description: 'A reply to a message that is not a question has no type',
    expected: {},
  },
];

tests.forEach(({args, description, expected}) => {
  return test(description, (context, end) => {
    deepEqual(replyActionType(args), expected, 'Got expected result');

    return end();
  });
});
