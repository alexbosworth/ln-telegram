const {deepEqual} = require('node:assert').strict;
const {InlineKeyboard} = require('grammy');
const {rejects} = require('node:assert').strict;
const test = require('node:test');

const setInvoiceNode = require('./../../buttons/set_invoice_node');
const {request} = require('./../fixtures/encoded');

const entities = [{length: 267, offset: 34, type: 'code'}];
const key = Buffer.alloc(33, 2).toString('hex');
const otherKey = Buffer.alloc(33, 3).toString('hex');
const title = 'Invoice: 0.00000001 “description”';

const makeCtx = ({}) => {
  const calls = {answered: 0, edits: []};

  return {
    calls,
    answerCallbackQuery: async () => calls.answered++,
    editMessageText: async (text, options) => {
      return calls.edits.push({options, text: text.split('\n')});
    },
    update: {
      callback_query: {message: {entities, text: `${title}\n${request}`}},
    },
  };
};

const makeArgs = overrides => {
  const args = {
    ctx: makeCtx({}),
    nodes: [
      {from: 'node1', public_key: key},
      {from: 'node2', public_key: otherKey},
    ],
  };

  Object.keys(overrides).forEach(k => args[k] = overrides[k]);

  return args;
};

const tests = [
  {
    args: makeArgs({ctx: undefined}),
    description: 'A Telegram context is expected',
    error: [400, 'ExpectedTelegramContextToHandleInvoiceNodePress'],
  },
  {
    args: makeArgs({nodes: undefined}),
    description: 'An array of saved nodes is expected',
    error: [400, 'ExpectedArrayOfSavedNodesToHandleSetInvoiceNode'],
  },
  {
    args: makeArgs({}),
    description: 'A button to move the invoice to each node is shown',
    expected: {
      answered: 1,
      edits: [{
        options: {
          entities,
          reply_markup: new InlineKeyboard()
            .text('Set Memo', 'set-invoice-description')
            .text('Amount...', 'set-invoice-tokens')
            .text('🗑', 'cancel-invoice')
            .row()
            .text(
              'Node: node1',
              'switch-invoice-to-0202020202020202020202020202020202020202020202'
            )
            .row()
            .text(
              'Node: node2',
              'switch-invoice-to-0303030303030303030303030303030303030303030303'
            )
            .row(),
        },
        text: [title, request],
      }],
    },
  },
];

tests.forEach(({args, description, error, expected}) => {
  return test(description, async () => {
    if (!!error) {
      await rejects(setInvoiceNode(args), error, 'Got expected error');
    } else {
      await setInvoiceNode(args);

      deepEqual(args.ctx.calls, expected, 'Got expected Telegram calls');
    }

    return;
  });
});
