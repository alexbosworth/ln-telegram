const {deepEqual} = require('node:assert').strict;
const {InlineKeyboard} = require('grammy');
const {rejects} = require('node:assert').strict;
const test = require('node:test');

const {postCreatedInvoice} = require('./../../post');
const {request} = require('./../fixtures/encoded');

const key = Buffer.alloc(33, 2).toString('hex');
const otherKey = Buffer.alloc(33, 3).toString('hex');

const makeCtx = ({err}) => {
  const replies = [];

  return {
    replies,
    reply: async (text, options) => {
      replies.push({options, text: text.split('\n')});

      if (!!err) {
        throw new Error(err);
      }

      return;
    },
  };
};

const makeLnd = ({err}) => {
  return {
    default: {
      addInvoice: ({}, cbk) => {
        if (!!err) {
          return cbk(err);
        }

        return cbk(null, {
          payment_addr: Buffer.alloc(32),
          payment_request: request,
        });
      },
      lookupInvoice: ({}, cbk) => cbk(null, {
        add_index: '1',
        amt_paid_msat: '0',
        amt_paid_sat: '0',
        cltv_expiry: '18',
        creation_date: '1',
        description_hash: Buffer.alloc(0),
        expiry: '1',
        fallback_addr: '',
        features: {},
        htlcs: [],
        is_keysend: false,
        memo: 'description',
        payment_addr: Buffer.alloc(32),
        payment_request: request,
        private: true,
        r_hash: Buffer.alloc(32),
        r_preimage: Buffer.alloc(32),
        settle_date: '0',
        settle_index: '0',
        settled: false,
        state: 'OPEN',
        value: '1',
        value_msat: '1000',
      }),
    },
  };
};

const makeArgs = overrides => {
  const args = {
    ctx: makeCtx({}),
    description: 'description',
    destination: key,
    nodes: [{from: 'node1', lnd: makeLnd({}), public_key: key}],
    tokens: 1,
  };

  Object.keys(overrides).forEach(k => args[k] = overrides[k]);

  return args;
};

const tests = [
  {
    args: makeArgs({ctx: undefined}),
    description: 'A Telegram context is expected',
    error: [400, 'ExpectedTelegramContextToPostCreatedInvoice'],
  },
  {
    args: makeArgs({destination: undefined}),
    description: 'An invoice destination is expected',
    error: [400, 'ExpectedInvoiceDestinationToPostCreatedInvoice'],
  },
  {
    args: makeArgs({nodes: undefined}),
    description: 'An array of nodes is expected',
    error: [400, 'ExpectedArrayOfNodesToPostCreatedInvoice'],
  },
  {
    args: makeArgs({}),
    description: 'A created invoice is posted',
    expected: {
      replies: [{
        options: {
          parse_mode: 'MarkdownV2',
          reply_markup: new InlineKeyboard()
            .text('Set Memo', 'set-invoice-description')
            .text('Amount...', 'set-invoice-tokens')
            .text('🗑', 'cancel-invoice'),
        },
        text: ['Invoice: 0\\.00000001 “description”', `\`${request}\``],
      }],
    },
  },
  {
    args: makeArgs({
      nodes: [
        {from: 'node2', lnd: makeLnd({err: 'err'}), public_key: otherKey},
        {from: 'node1', lnd: makeLnd({}), public_key: key},
      ],
    }),
    description: 'A created invoice is posted with the node it was created on',
    expected: {
      replies: [{
        options: {
          parse_mode: 'MarkdownV2',
          reply_markup: new InlineKeyboard()
            .text('Set Memo', 'set-invoice-description')
            .text('Amount...', 'set-invoice-tokens')
            .text('Node...', 'set-invoice-node')
            .text('🗑', 'cancel-invoice'),
        },
        text: [
          'Invoice: 0\\.00000001 “description”',
          `\`${request}\``,
          'node1',
        ],
      }],
    },
  },
  {
    args: makeArgs({
      nodes: [{from: 'node1', lnd: makeLnd({err: 'err'}), public_key: key}],
    }),
    description: 'A failure to create the invoice is posted',
    expected: {
      replies: [{
        options: {
          parse_mode: 'Markdown',
          reply_markup: new InlineKeyboard().text('OK', 'remove-message'),
        },
        text: ['⚠️ *Failed to create invoice: AddInvoiceError*'],
      }],
    },
  },
  {
    args: makeArgs({
      ctx: makeCtx({err: 'err'}),
      nodes: [{from: 'node1', lnd: makeLnd({err: 'err'}), public_key: key}],
    }),
    description: 'An error posting the create invoice failure is ignored',
    expected: {
      replies: [{
        options: {
          parse_mode: 'Markdown',
          reply_markup: new InlineKeyboard().text('OK', 'remove-message'),
        },
        text: ['⚠️ *Failed to create invoice: AddInvoiceError*'],
      }],
    },
  },
];

tests.forEach(({args, description, error, expected}) => {
  return test(description, async () => {
    if (!!error) {
      await rejects(postCreatedInvoice(args), error, 'Got expected error');
    } else {
      await postCreatedInvoice(args);

      deepEqual(args.ctx.replies, expected.replies, 'Got expected replies');
    }

    return;
  });
});
