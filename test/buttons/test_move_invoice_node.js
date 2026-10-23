const {deepEqual} = require('node:assert').strict;
const {InlineKeyboard} = require('grammy');
const {rejects} = require('node:assert').strict;
const test = require('node:test');

const moveInvoiceNode = require('./../../buttons/move_invoice_node');
const {key} = require('./../fixtures/encoded');
const {request} = require('./../fixtures/encoded');

const actions = {
  parse_mode: 'Markdown',
  reply_markup: new InlineKeyboard().text('OK', 'remove-message'),
};
const id = Buffer.alloc(32).toString('hex');
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
    update: {
      callback_query: {
        data: 'switch-invoice-to-0303030303030303030303030303030303030303030303',
        message: {text},
      },
    },
  };
};

// The node records the invoices it cancels and how many invoices it creates
const makeLnd = ({addErr, cancelErr, lookupErr, settled}) => {
  const calls = {canceled: [], created: 0};

  return {
    calls,
    default: {
      addInvoice: ({}, cbk) => {
        calls.created++;

        if (!!addErr) {
          return cbk(addErr);
        }

        return cbk(null, {
          payment_addr: Buffer.alloc(32),
          payment_request: request,
        });
      },
      lookupInvoice: ({}, cbk) => {
        if (!!lookupErr) {
          return cbk(lookupErr);
        }

        return cbk(null, {
          add_index: '1',
          amt_paid_msat: !!settled ? '1000' : '0',
          amt_paid_sat: !!settled ? '1' : '0',
          cltv_expiry: '18',
          creation_date: '1',
          description_hash: Buffer.alloc(0),
          expiry: '1',
          features: {},
          htlcs: [],
          is_keysend: false,
          memo: 'description',
          payment_addr: Buffer.alloc(32),
          payment_request: request,
          private: true,
          r_hash: Buffer.alloc(32),
          r_preimage: Buffer.alloc(32),
          settle_date: !!settled ? '1' : '0',
          settle_index: !!settled ? '1' : '0',
          settled: !!settled,
          state: !!settled ? 'SETTLED' : 'OPEN',
          value: '1',
          value_msat: '1000',
        });
      },
    },
    invoices: {
      cancelInvoice: ({payment_hash}, cbk) => {
        calls.canceled.push(payment_hash.toString('hex'));

        if (!!cancelErr) {
          return cbk(cancelErr);
        }

        return cbk();
      },
    },
  };
};

// The invoice was created on node1 and is moved to node2
const makeArgs = overrides => {
  const args = {
    ctx: makeCtx({text: `${title}\n${request}`}),
    nodes: [
      {from: 'node1', lnd: makeLnd({}), public_key: key},
      {from: 'node2', lnd: makeLnd({}), public_key: otherKey},
    ],
  };

  Object.keys(overrides).forEach(k => args[k] = overrides[k]);

  return args;
};

const tests = [
  {
    args: makeArgs({ctx: undefined}),
    description: 'A Telegram context is expected',
    error: [400, 'ExpectedTelegramContextToMoveInvoiceNode'],
  },
  {
    args: makeArgs({nodes: undefined}),
    description: 'An array of nodes is expected',
    error: [400, 'ExpectedArrayOfNodesToMoveInvoiceNode'],
  },
  {
    args: makeArgs({}),
    description: 'The invoice is canceled and created again on the new node',
    expected: {
      ctx: {
        answered: 1,
        deleted: 1,
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
            'node2',
          ],
        }],
      },
      nodes: [{canceled: [id], created: 0}, {canceled: [], created: 1}],
    },
  },
  {
    args: makeArgs({ctx: makeCtx({text: title})}),
    description: 'A payment request is expected on the invoice message',
    expected: {
      ctx: {
        answered: 1,
        deleted: 0,
        replies: [{
          options: actions,
          text: [
            '⚠️ Could not move the invoice. Try again?',
          ],
        }],
      },
      nodes: [{canceled: [], created: 0}, {canceled: [], created: 0}],
    },
  },
  {
    args: makeArgs({
      nodes: [{from: 'node1', lnd: makeLnd({}), public_key: key}],
    }),
    description: 'The selected node is expected to be a known node',
    expected: {
      ctx: {
        answered: 1,
        deleted: 0,
        replies: [{
          options: actions,
          text: [
            '⚠️ The node to move this invoice to is not connected.',
          ],
        }],
      },
      nodes: [{canceled: [], created: 0}],
    },
  },
  {
    args: makeArgs({ctx: makeCtx({text: `${title}\nrequest`})}),
    description: 'A valid payment request is expected on the invoice message',
    expected: {
      ctx: {
        answered: 1,
        deleted: 0,
        replies: [{
          options: actions,
          text: [
            '⚠️ Could not move the invoice. Try again?',
          ],
        }],
      },
      nodes: [{canceled: [], created: 0}, {canceled: [], created: 0}],
    },
  },
  {
    args: makeArgs({
      nodes: [{from: 'node2', lnd: makeLnd({}), public_key: otherKey}],
    }),
    description: 'The invoice is expected to be from a known node',
    expected: {
      ctx: {
        answered: 1,
        deleted: 0,
        replies: [{
          options: actions,
          text: [
            '⚠️ The node that made this invoice is not connected, so it cannot be moved.',
          ],
        }],
      },
      nodes: [{canceled: [], created: 0}],
    },
  },
  {
    args: makeArgs({
      nodes: [
        {from: 'node1', lnd: makeLnd({cancelErr: 'err'}), public_key: key},
        {from: 'node2', lnd: makeLnd({}), public_key: otherKey},
      ],
    }),
    description: 'A failure to cancel the invoice is posted',
    expected: {
      ctx: {
        answered: 1,
        deleted: 0,
        replies: [{
          options: actions,
          text: [
            '⚠️ Could not move the invoice. Try again?',
          ],
        }],
      },
      nodes: [{canceled: [id], created: 0}, {canceled: [], created: 0}],
    },
  },
  {
    args: makeArgs({
      nodes: [
        {
          from: 'node1',
          lnd: makeLnd({
            cancelErr: {details: 'invoice already settled'},
            settled: true,
          }),
          public_key: key,
        },
        {from: 'node2', lnd: makeLnd({}), public_key: otherKey},
      ],
    }),
    description: 'A paid invoice is not moved',
    expected: {
      ctx: {
        answered: 1,
        deleted: 0,
        replies: [{
          options: actions,
          text: ['⚠️ _Invoice already paid, so it cannot be changed._'],
        }],
      },
      nodes: [{canceled: [id], created: 0}, {canceled: [], created: 0}],
    },
  },
  {
    args: makeArgs({
      nodes: [
        {
          from: 'node1',
          lnd: makeLnd({cancelErr: 'err', lookupErr: 'err'}),
          public_key: key,
        },
        {from: 'node2', lnd: makeLnd({}), public_key: otherKey},
      ],
    }),
    description: 'A failure to cancel an invoice that is not found is posted',
    expected: {
      ctx: {
        answered: 1,
        deleted: 0,
        replies: [{
          options: actions,
          text: [
            '⚠️ Could not move the invoice. Try again?',
          ],
        }],
      },
      nodes: [{canceled: [id], created: 0}, {canceled: [], created: 0}],
    },
  },
  {
    args: makeArgs({
      nodes: [
        {from: 'node1', lnd: makeLnd({}), public_key: key},
        {from: 'node2', lnd: makeLnd({addErr: 'err'}), public_key: otherKey},
      ],
    }),
    description: 'A failure to create the invoice on the new node is posted',
    expected: {
      ctx: {
        answered: 1,
        deleted: 1,
        replies: [{
          options: actions,
          text: ['⚠️ *Failed to create invoice: AddInvoiceError*'],
        }],
      },
      nodes: [{canceled: [id], created: 0}, {canceled: [], created: 1}],
    },
  },
];

tests.forEach(({args, description, error, expected}) => {
  return test(description, async () => {
    if (!!error) {
      await rejects(moveInvoiceNode(args), error, 'Got expected error');
    } else {
      await moveInvoiceNode(args);

      const res = {
        ctx: args.ctx.calls,
        nodes: args.nodes.map(({lnd}) => lnd.calls),
      };

      deepEqual(res, expected, 'Got expected result');
    }

    return;
  });
});
