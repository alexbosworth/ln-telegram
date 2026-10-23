const {deepEqual} = require('node:assert').strict;
const {InlineKeyboard} = require('grammy');
const {rejects} = require('node:assert').strict;
const test = require('node:test');

const {handleInvoiceCommand} = require('./../../');
const {request} = require('./../fixtures/encoded');
const {zeroRequest} = require('./../fixtures/encoded');

const key = Buffer.alloc(33, 2).toString('hex');
const otherKey = Buffer.alloc(33, 3).toString('hex');

const makeCtx = ({deleteErr, err, from, match}) => {
  const replies = [];

  return {
    match,
    replies,
    deleteMessage: async () => {
      if (!!deleteErr) {
        throw new Error(deleteErr);
      }

      return;
    },
    message: {from: {id: from || 1}},
    reply: async (text, options) => {
      replies.push({options, text: text.split('\n')});

      if (!!err) {
        throw new Error(err);
      }

      return;
    },
  };
};

const makeLnd = ({}) => {
  const invoices = [];

  return {
    invoices,
    default: {
      addInvoice: ({memo, value_msat}, cbk) => {
        invoices.push({memo, value_msat});

        return cbk(null, {
          payment_addr: Buffer.alloc(32),
          payment_request: !Number(value_msat) ? zeroRequest : request,
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
    ctx: makeCtx({match: '1 description'}),
    id: 1,
    nodes: [{from: 'node1', lnd: makeLnd({}), public_key: key}],
    request: ({}, cbk) => cbk('err'),
  };

  Object.keys(overrides).forEach(k => args[k] = overrides[k]);

  return args;
};

const tests = [
  {
    args: makeArgs({ctx: undefined}),
    description: 'A Telegram context is expected',
    error: [400, 'ExpectedTelegramMessageContextToCreateInvoice'],
  },
  {
    args: makeArgs({nodes: undefined}),
    description: 'An array of nodes is expected',
    error: [400, 'ExpectedArrayOfNodesToCreateInvoice'],
  },
  {
    args: makeArgs({nodes: []}),
    description: 'A node is expected',
    error: [400, 'ExpectedArrayOfNodesToCreateInvoice'],
  },
  {
    args: makeArgs({request: undefined}),
    description: 'A request function is expected',
    error: [400, 'ExpectedRequestFunctionToCreateInvoice'],
  },
  {
    args: makeArgs({ctx: makeCtx({from: 2})}),
    description: 'The command is only allowed for the connected user',
    error: [401, 'CommandRequiresConnectCode'],
  },
  {
    args: makeArgs({}),
    description: 'An invoice is created for an amount and description',
    expected: {
      invoices: [[{memo: 'description', value_msat: '1000'}]],
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
    args: makeArgs({ctx: makeCtx({})}),
    description: 'An invoice is created without an amount or description',
    expected: {
      invoices: [[{memo: '', value_msat: '0'}]],
      replies: [{
        options: {
          parse_mode: 'MarkdownV2',
          reply_markup: new InlineKeyboard()
            .text('Set Memo', 'set-invoice-description')
            .text('Amount...', 'set-invoice-tokens')
            .text('🗑', 'cancel-invoice'),
        },
        text: ['Invoice: 0\\.00000000 ', `\`${zeroRequest}\``],
      }],
    },
  },
  {
    args: makeArgs({
      nodes: [
        {from: 'node1', lnd: makeLnd({}), public_key: key},
        {from: 'node2', lnd: makeLnd({}), public_key: otherKey},
      ],
    }),
    description: 'An invoice is created on the first node',
    expected: {
      invoices: [[{memo: 'description', value_msat: '1000'}], []],
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
      ctx: makeCtx({deleteErr: 'err', match: '1 description'}),
    }),
    description: 'An error removing the command message is ignored',
    expected: {
      invoices: [[{memo: 'description', value_msat: '1000'}]],
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
    args: makeArgs({ctx: makeCtx({match: '1.5 description'})}),
    description: 'A failure to understand the amount is posted',
    expected: {
      invoices: [[]],
      replies: [{
        options: {
          parse_mode: 'Markdown',
          reply_markup: new InlineKeyboard().text('OK', 'remove-message'),
        },
        text: ['ExpectedIntegerAmountToParseAmount'],
      }],
    },
  },
  {
    args: makeArgs({ctx: makeCtx({err: 'err', match: '1.5'})}),
    description: 'An error posting the failure is ignored',
    expected: {
      invoices: [[]],
      replies: [{
        options: {
          parse_mode: 'Markdown',
          reply_markup: new InlineKeyboard().text('OK', 'remove-message'),
        },
        text: ['ExpectedIntegerAmountToParseAmount'],
      }],
    },
  },
  {
    args: makeArgs({ctx: makeCtx({err: 'err', match: '1 description'})}),
    description: 'A failure to post the created invoice is reported',
    expected: {
      invoices: [[{memo: 'description', value_msat: '1000'}]],
      replies: [
        {
          options: {
            parse_mode: 'MarkdownV2',
            reply_markup: new InlineKeyboard()
              .text('Set Memo', 'set-invoice-description')
              .text('Amount...', 'set-invoice-tokens')
              .text('🗑', 'cancel-invoice'),
          },
          text: ['Invoice: 0\\.00000001 “description”', `\`${request}\``],
        },
        {
          options: {
            parse_mode: 'Markdown',
            reply_markup: new InlineKeyboard().text('OK', 'remove-message'),
          },
          text: ['err'],
        },
      ],
    },
  },
];

tests.forEach(({args, description, error, expected}) => {
  return test(description, async () => {
    if (!!error) {
      await rejects(handleInvoiceCommand(args), error, 'Got expected error');
    } else {
      await handleInvoiceCommand(args);

      const res = {
        invoices: args.nodes.map(({lnd}) => lnd.invoices),
        replies: args.ctx.replies,
      };

      deepEqual(res, expected, 'Got expected result');
    }

    return;
  });
});
