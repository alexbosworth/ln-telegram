const {deepEqual} = require('node:assert').strict;
const test = require('node:test');

const invoiceActionType = require('./../../replies/invoice_action_type');
const {key} = require('./../fixtures/encoded');
const {request} = require('./../fixtures/encoded');

const join = lines => lines.join('\n');
const otherKey = Buffer.alloc(33, 2).toString('hex');
const title = 'Invoice: 0.00000001 “description”';

const makeArgs = overrides => {
  const args = {
    nodes: [{public_key: key}],
    text: join([title, request, '', 'What is this invoice for?']),
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
      text: join([title, request, '', 'How much should this invoice be for?']),
    }),
    description: 'A reply to the invoice amount question is mapped',
    expected: {type: 'set-invoice-tokens'},
  },
  {
    args: makeArgs({text: undefined}),
    description: 'A message without text is not an invoice action',
    expected: {},
  },
  {
    args: makeArgs({text: 'text'}),
    description: 'A message without the invoice title is not an invoice action',
    expected: {},
  },
  {
    args: makeArgs({text: title}),
    description: 'An invoice message needs a payment request',
    expected: {},
  },
  {
    args: makeArgs({
      text: join([title, request, 'spacer', 'What is this invoice for?']),
    }),
    description: 'An invoice message needs a blank line before the question',
    expected: {},
  },
  {
    args: makeArgs({
      text: join([title, request, '', 'What is this invoice for?', 'other']),
    }),
    description: 'An invoice message cannot have lines after the question',
    expected: {},
  },
  {
    args: makeArgs({
      text: join([title, request, '', 'What are you selling?']),
    }),
    description: 'An invoice message needs an invoice question',
    expected: {},
  },
  {
    args: makeArgs({
      text: join([title, 'request', '', 'What is this invoice for?']),
    }),
    description: 'An invoice message needs a valid payment request',
    expected: {},
  },
  {
    args: makeArgs({nodes: [{public_key: otherKey}]}),
    description: 'An invoice message needs an invoice from a known node',
    expected: {},
  },
];

tests.forEach(({args, description, expected}) => {
  return test(description, (context, end) => {
    deepEqual(invoiceActionType(args), expected, 'Got expected result');

    return end();
  });
});
