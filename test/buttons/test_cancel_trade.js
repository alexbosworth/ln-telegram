const {deepEqual} = require('node:assert').strict;
const {InlineKeyboard} = require('grammy');
const {rejects} = require('node:assert').strict;
const test = require('node:test');

const cancelTrade = require('./../../buttons/cancel_trade');
const {request} = require('./../fixtures/encoded');
const {swapTrade} = require('./../fixtures/encoded');
const {trade} = require('./../fixtures/encoded');
const {tradeWithoutId} = require('./../fixtures/encoded');

const actions = {
  parse_mode: 'Markdown',
  reply_markup: new InlineKeyboard().text('OK', 'remove-message'),
};
const anchor = 'anchor-trade-secret:AAZzZWNyZXQBC2Rlc2NyaXB0aW9u';
const key = Buffer.alloc(33, 2).toString('hex');
const otherKey = Buffer.alloc(33, 3).toString('hex');
const title = 'Trade-Secret: 0.00000001 “description” expires 1/1/2026';

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

const makeLnd = ({cancelErr, lookupErr}) => {
  return {
    default: {
      lookupInvoice: ({}, cbk) => {
        if (!!lookupErr) {
          return cbk(lookupErr);
        }

        return cbk(null, {
          add_index: '1',
          amt_paid_msat: '0',
          amt_paid_sat: '0',
          cltv_expiry: '18',
          creation_date: '1',
          description_hash: Buffer.alloc(0),
          expiry: '1',
          features: {},
          htlcs: [],
          is_keysend: false,
          memo: anchor,
          payment_addr: Buffer.alloc(32),
          payment_request: request,
          private: false,
          r_hash: Buffer.alloc(32),
          r_preimage: Buffer.alloc(32),
          settle_date: '0',
          settle_index: '0',
          settled: false,
          state: 'OPEN',
          value: '1',
          value_msat: '1000',
        });
      },
    },
    invoices: {cancelInvoice: ({}, cbk) => cbk(cancelErr)},
  };
};

const makeArgs = overrides => {
  const args = {
    ctx: makeCtx({text: `${title}\n${trade}`}),
    nodes: [{from: 'node1', lnd: makeLnd({}), public_key: key}],
  };

  Object.keys(overrides).forEach(k => args[k] = overrides[k]);

  return args;
};

const tests = [
  {
    args: makeArgs({ctx: undefined}),
    description: 'A Telegram context is expected',
    error: [400, 'ExpectedTelegramContextToCancelTrade'],
  },
  {
    args: makeArgs({nodes: undefined}),
    description: 'An array of nodes is expected',
    error: [400, 'ExpectedArrayOfNodesToCancelTrade'],
  },
  {
    args: makeArgs({}),
    description: 'The trade is canceled and the trade message is removed',
    expected: {answered: 1, deleted: 1, replies: []},
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
    description: 'The trade is canceled on the node that has the trade',
    expected: {answered: 1, deleted: 1, replies: []},
  },
  {
    args: makeArgs({ctx: makeCtx({text: title})}),
    description: 'A trade is expected on the trade message',
    expected: {
      answered: 1,
      deleted: 0,
      replies: [{
        options: actions,
        text: [
          '⚠️ Unexpected error `FailedToDecodeTradeToCancel`. Try again?',
        ],
      }],
    },
  },
  {
    args: makeArgs({ctx: makeCtx({text: `${title}\n${swapTrade}`})}),
    description: 'An open trade is expected on the trade message',
    expected: {
      answered: 1,
      deleted: 0,
      replies: [{
        options: actions,
        text: ['⚠️ Unexpected error `ExpectedOpenTradeToCancel`. Try again?'],
      }],
    },
  },
  {
    args: makeArgs({ctx: makeCtx({text: `${title}\n${tradeWithoutId}`})}),
    description: 'A trade id is expected on the trade message',
    expected: {
      answered: 1,
      deleted: 0,
      replies: [{
        options: actions,
        text: [
          '⚠️ Unexpected error `ExpectedOpenTradeIdToCancel`. Try again?',
        ],
      }],
    },
  },
  {
    args: makeArgs({
      nodes: [
        {from: 'node1', lnd: makeLnd({lookupErr: 'err'}), public_key: key},
      ],
    }),
    description: 'A trade that is not found on a node is removed',
    expected: {answered: 1, deleted: 1, replies: []},
  },
  {
    args: makeArgs({
      nodes: [
        {from: 'node1', lnd: makeLnd({cancelErr: 'err'}), public_key: key},
      ],
    }),
    description: 'A failure to cancel the trade is posted',
    expected: {
      answered: 1,
      deleted: 0,
      replies: [{
        options: actions,
        text: [
          '⚠️ Unexpected error `UnexpectedErrorCancelingHodlInvoice`. Try again?',
        ],
      }],
    },
  },
];

tests.forEach(({args, description, error, expected}) => {
  return test(description, async () => {
    if (!!error) {
      await rejects(cancelTrade(args), error, 'Got expected error');
    } else {
      await cancelTrade(args);

      deepEqual(args.ctx.calls, expected, 'Got expected Telegram calls');
    }

    return;
  });
});
