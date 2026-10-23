const {deepEqual} = require('node:assert').strict;
const {InlineKeyboard} = require('grammy');
const {rejects} = require('node:assert').strict;
const test = require('node:test');

const method = require('./../../buttons/set_invoice_description');
const {key} = require('./../fixtures/encoded');
const {request} = require('./../fixtures/encoded');

const actions = {
  parse_mode: 'Markdown',
  reply_markup: new InlineKeyboard().text('OK', 'remove-message'),
};
const otherKey = Buffer.alloc(33, 3).toString('hex');
const title = 'Invoice: 0.00000001 “description”';

const makeCtx = ({text}) => {
  const calls = {answered: 0, deleted: 0, replies: []};

  return {
    calls,
    answerCallbackQuery: async () => calls.answered++,
    deleteMessage: async () => calls.deleted++,
    reply: async (text, options) => {
      return calls.replies.push({options, text: text.split('\n')});
    },
    update: {callback_query: {message: {text}}},
  };
};

const makeArgs = overrides => {
  const args = {
    ctx: makeCtx({text: `${title}\n${request}`}),
    nodes: [{from: 'node1', public_key: key}],
  };

  Object.keys(overrides).forEach(k => args[k] = overrides[k]);

  return args;
};

const tests = [
  {
    args: makeArgs({ctx: undefined}),
    description: 'A Telegram context is expected',
    error: [400, 'ExpectedTelegramContextToSetInvoiceDescription'],
  },
  {
    args: makeArgs({nodes: undefined}),
    description: 'An array of nodes is expected',
    error: [400, 'ExpectedArrayOfNodesToSetInvoiceDescription'],
  },
  {
    args: makeArgs({}),
    description: 'A new invoice description is asked for',
    expected: {
      answered: 1,
      deleted: 1,
      replies: [{
        options: {
          parse_mode: 'MarkdownV2',
          reply_markup: {
            force_reply: true,
            input_field_placeholder: 'Enter description...',
          },
        },
        text: [
          'Invoice: 0\\.00000001 “description”',
          `\`${request}\``,
          '',
          '_What is this invoice for?_',
        ],
      }],
    },
  },
  {
    args: makeArgs({ctx: makeCtx({text: ''})}),
    description: 'An invoice title is expected on the invoice message',
    expected: {
      answered: 1,
      deleted: 0,
      replies: [{
        options: actions,
        text: [
          '⚠️ Unexpected error `ExpectedInvoiceTitleOnInvoiceMessage`. Try again?',
        ],
      }],
    },
  },
  {
    args: makeArgs({ctx: makeCtx({text: title})}),
    description: 'A payment request is expected on the invoice message',
    expected: {
      answered: 1,
      deleted: 0,
      replies: [{
        options: actions,
        text: [
          '⚠️ Unexpected error `ExpectedPaymentRequestOnInvoiceMessage`. Try again?',
        ],
      }],
    },
  },
  {
    args: makeArgs({ctx: makeCtx({text: `${title}\nrequest`})}),
    description: 'A valid payment request is expected on the invoice message',
    expected: {
      answered: 1,
      deleted: 0,
      replies: [{
        options: actions,
        text: [
          '⚠️ Unexpected error `ExpectedValidPaymentRequestToSetInvoiceMemo`. Try again?',
        ],
      }],
    },
  },
  {
    args: makeArgs({nodes: [{from: 'node2', public_key: otherKey}]}),
    description: 'The invoice is expected to be from a known node',
    expected: {
      answered: 1,
      deleted: 0,
      replies: [{
        options: actions,
        text: [
          '⚠️ Unexpected error `MissingNodeToUpdateInvoiceDescriptionFor`. Try again?',
        ],
      }],
    },
  },
];

tests.forEach(({args, description, error, expected}) => {
  return test(description, async () => {
    if (!!error) {
      await rejects(method(args), error, 'Got expected error');
    } else {
      await method(args);

      deepEqual(args.ctx.calls, expected, 'Got expected Telegram calls');
    }

    return;
  });
});
