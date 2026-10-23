const {deepEqual} = require('node:assert').strict;
const {InlineKeyboard} = require('grammy');
const {rejects} = require('node:assert').strict;
const test = require('node:test');

const cancelInvoice = require('./../../buttons/cancel_invoice');
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
    update: {callback_query: {message: {text}}},
  };
};

// The node has the invoice, which can fail to cancel or can be already paid
const makeLnd = ({cancelErr, lookupErr, settled}) => {
  const canceled = [];

  return {
    canceled,
    default: {
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
        canceled.push(payment_hash.toString('hex'));

        if (!!cancelErr) {
          return cbk(cancelErr);
        }

        return cbk();
      },
    },
  };
};

const makeArgs = overrides => {
  const args = {
    ctx: makeCtx({text: `${title}\n${request}`}),
    nodes: [{lnd: makeLnd({}), public_key: key}],
  };

  Object.keys(overrides).forEach(k => args[k] = overrides[k]);

  return args;
};

const tests = [
  {
    args: makeArgs({ctx: undefined}),
    description: 'A Telegram context is expected',
    error: [400, 'ExpectedTelegramContextToHandleCancelInvoice'],
  },
  {
    args: makeArgs({nodes: undefined}),
    description: 'An array of nodes is expected',
    error: [400, 'ExpectedArrayOfNodesToHandleCancelInvoice'],
  },
  {
    args: makeArgs({}),
    description: 'The invoice is canceled and the invoice message is removed',
    expected: {
      calls: {answered: 1, deleted: 1, replies: []},
      canceled: [id],
    },
  },
  {
    args: makeArgs({ctx: makeCtx({text: title})}),
    description: 'A payment request is expected on the invoice message',
    expected: {
      calls: {
        answered: 1,
        deleted: 0,
        replies: [{
          options: actions,
          text: [
            '⚠️ Could not cancel the invoice. Try again?',
          ],
        }],
      },
      canceled: [],
    },
  },
  {
    args: makeArgs({ctx: makeCtx({text: `${title}\nrequest`})}),
    description: 'A valid payment request is expected on the invoice message',
    expected: {
      calls: {
        answered: 1,
        deleted: 0,
        replies: [{
          options: actions,
          text: [
            '⚠️ Could not cancel the invoice. Try again?',
          ],
        }],
      },
      canceled: [],
    },
  },
  {
    args: makeArgs({nodes: [{lnd: makeLnd({}), public_key: otherKey}]}),
    description: 'The invoice is expected to be from a known node',
    expected: {
      calls: {
        answered: 1,
        deleted: 0,
        replies: [{
          options: actions,
          text: [
            '⚠️ The node that made this invoice is not connected, so it cannot be canceled.',
          ],
        }],
      },
      canceled: [],
    },
  },
  {
    args: makeArgs({
      nodes: [{
        lnd: makeLnd({
          cancelErr: {details: 'invoice already settled'},
          settled: true,
        }),
        public_key: key,
      }],
    }),
    description: 'The message of an invoice that was already paid is removed',
    expected: {
      calls: {answered: 1, deleted: 1, replies: []},
      canceled: [id],
    },
  },
  {
    args: makeArgs({
      nodes: [{lnd: makeLnd({cancelErr: 'err'}), public_key: key}],
    }),
    description: 'A failure to cancel the invoice is posted',
    expected: {
      calls: {
        answered: 1,
        deleted: 0,
        replies: [{
          options: actions,
          text: [
            '⚠️ Could not cancel the invoice. Try again?',
          ],
        }],
      },
      canceled: [id],
    },
  },
  {
    args: makeArgs({
      nodes: [{
        lnd: makeLnd({cancelErr: 'err', lookupErr: 'err'}),
        public_key: key,
      }],
    }),
    description: 'A failure to cancel an invoice that is not found is posted',
    expected: {
      calls: {
        answered: 1,
        deleted: 0,
        replies: [{
          options: actions,
          text: [
            '⚠️ Could not cancel the invoice. Try again?',
          ],
        }],
      },
      canceled: [id],
    },
  },
];

tests.forEach(({args, description, error, expected}) => {
  return test(description, async () => {
    if (!!error) {
      await rejects(cancelInvoice(args), error, 'Got expected error');
    } else {
      await cancelInvoice(args);

      const [{lnd}] = args.nodes;

      const res = {calls: args.ctx.calls, canceled: lnd.canceled};

      deepEqual(res, expected, 'Got expected result');
    }

    return;
  });
});
