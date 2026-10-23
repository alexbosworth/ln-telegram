const {deepEqual} = require('node:assert').strict;
const {InlineKeyboard} = require('grammy');
const test = require('node:test');

const {createInvoiceMessage} = require('./../../messages');
const {request} = require('./../fixtures/encoded');
const {zeroRequest} = require('./../fixtures/encoded');


const tests = [
  {
    args: {request},
    description: 'A created invoice message is mapped',
    expected: {
      markup: new InlineKeyboard()
        .text('Set Memo', 'set-invoice-description')
        .text('Amount...', 'set-invoice-tokens')
        .text('🗑', 'cancel-invoice'),
      mode: 'MarkdownV2',
      text: [
        'Invoice: 0\\.00000001 “description”',
        `\`${request}\``,
      ].join('\n'),
    },
  },
  {
    args: {request, from: 'node-1'},
    description: 'A created invoice message shows the node it is from',
    expected: {
      markup: new InlineKeyboard()
        .text('Set Memo', 'set-invoice-description')
        .text('Amount...', 'set-invoice-tokens')
        .text('Node...', 'set-invoice-node')
        .text('🗑', 'cancel-invoice'),
      mode: 'MarkdownV2',
      text: [
        'Invoice: 0\\.00000001 “description”',
        `\`${request}\``,
        'node\\-1',
      ].join('\n'),
    },
  },
  {
    args: {request: zeroRequest},
    description: 'A created invoice message without an amount or memo is mapped',
    expected: {
      markup: new InlineKeyboard()
        .text('Set Memo', 'set-invoice-description')
        .text('Amount...', 'set-invoice-tokens')
        .text('🗑', 'cancel-invoice'),
      mode: 'MarkdownV2',
      text: ['Invoice: 0\\.00000000 ', `\`${zeroRequest}\``].join('\n'),
    },
  },
];

tests.forEach(({args, description, expected}) => {
  return test(description, (context, end) => {
    const res = createInvoiceMessage(args);

    deepEqual(res, expected, 'Got expected result');

    return end();
  });
});
