const {deepEqual} = require('node:assert').strict;
const {InlineKeyboard} = require('grammy');
const {rejects} = require('node:assert').strict;
const test = require('node:test');

const moveTradeNode = require('./../../buttons/move_trade_node');
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
    update: {
      callback_query: {
        data: 'switch-trade-to-0303030303030303030303030303030303030303030303',
        message: {text},
      },
    },
  };
};

const makeInvoice = overrides => {
  const invoice = {
    add_index: '1',
    amt_paid_msat: '0',
    amt_paid_sat: '0',
    cltv_expiry: '18',
    creation_date: '1',
    description_hash: Buffer.alloc(0),
    // The trade expires in 2100 so that it can be created again
    expiry: '4102444799',
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
  };

  Object.keys(overrides).forEach(k => invoice[k] = overrides[k]);

  return invoice;
};

const makeLnd = ({cancelErr, createErr, invoice, lookupErr}) => {
  return {
    default: {
      addInvoice: ({}, cbk) => {
        if (!!createErr) {
          return cbk(createErr);
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

        return cbk(null, invoice || makeInvoice({}));
      },
    },
    invoices: {cancelInvoice: ({}, cbk) => cbk(cancelErr)},
  };
};

const makeArgs = overrides => {
  const args = {
    ctx: makeCtx({text: `${title}\n${trade}`}),
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
    error: [400, 'ExpectedTelegramContextToMoveTradeSecret'],
  },
  {
    args: makeArgs({nodes: undefined}),
    description: 'An array of nodes is expected',
    error: [400, 'ExpectedArrayOfNodesToMoveTradeSecret'],
  },
  {
    args: makeArgs({}),
    description: 'The trade is moved to the selected node',
    expected: {answered: 1, deleted: 1, replies: []},
  },
  {
    args: makeArgs({ctx: makeCtx({text: ''})}),
    description: 'A trade title is expected on the trade message',
    expected: {
      answered: 1,
      deleted: 1,
      replies: [{
        options: actions,
        text: [
          '⚠️ Unexpected error `ExpectedTradeTitleToMoveTradeNode`. Try again?',
        ],
      }],
    },
  },
  {
    args: makeArgs({ctx: makeCtx({text: title})}),
    description: 'An encoded trade is expected on the trade message',
    expected: {
      answered: 1,
      deleted: 1,
      replies: [{
        options: actions,
        text: [
          '⚠️ Unexpected error `ExpectedEncodedTradeToMoveTradeNode`. Try again?',
        ],
      }],
    },
  },
  {
    args: makeArgs({ctx: makeCtx({text: `${title}\ntrade`})}),
    description: 'A valid trade is expected on the trade message',
    expected: {
      answered: 1,
      deleted: 1,
      replies: [{
        options: actions,
        text: [
          '⚠️ Unexpected error `ExpectedValidTradeToMoveTradeNode`. Try again?',
        ],
      }],
    },
  },
  {
    args: makeArgs({ctx: makeCtx({text: `${title}\n${swapTrade}`})}),
    description: 'An open trade is expected on the trade message',
    expected: {
      answered: 1,
      deleted: 1,
      replies: [{
        options: actions,
        text: [
          '⚠️ Unexpected error `ExpectedOpenTradeToMoveTradeNode`. Try again?',
        ],
      }],
    },
  },
  {
    args: makeArgs({ctx: makeCtx({text: `${title}\n${tradeWithoutId}`})}),
    description: 'A trade id is expected on the trade message',
    expected: {
      answered: 1,
      deleted: 1,
      replies: [{
        options: actions,
        text: [
          '⚠️ Unexpected error `ExpectedTradeIdToMoveTradeNode`. Try again?',
        ],
      }],
    },
  },
  {
    args: makeArgs({
      nodes: [{from: 'node1', lnd: makeLnd({}), public_key: key}],
    }),
    description: 'The selected node is expected to be a known node',
    expected: {
      answered: 1,
      deleted: 1,
      replies: [{
        options: actions,
        text: [
          '⚠️ Unexpected error `ExpectedKnownDestinationNodeToMoveTradeTo`. Try again?',
        ],
      }],
    },
  },
  {
    args: makeArgs({
      nodes: [
        {
          from: 'node1',
          lnd: makeLnd({invoice: makeInvoice({memo: 'memo'})}),
          public_key: key,
        },
        {from: 'node2', lnd: makeLnd({}), public_key: otherKey},
      ],
    }),
    description: 'A failure to get the trade details is posted',
    expected: {
      answered: 1,
      deleted: 1,
      replies: [{
        options: actions,
        text: ['⚠️ Unexpected error `ExpectedAnchoredTradeData`. Try again?'],
      }],
    },
  },
  {
    args: makeArgs({
      nodes: [
        {from: 'node1', lnd: makeLnd({lookupErr: 'err'}), public_key: key},
        {
          from: 'node2',
          lnd: makeLnd({lookupErr: 'err'}),
          public_key: otherKey,
        },
      ],
    }),
    description: 'A trade that is not found on a node cannot be moved',
    expected: {
      answered: 1,
      deleted: 1,
      replies: [{
        options: actions,
        text: [
          '⚠️ Unexpected error `FailedToFindRelatedAnchoredTradeToMove`. Try again?',
        ],
      }],
    },
  },
  {
    args: makeArgs({
      nodes: [
        {from: 'node1', lnd: makeLnd({cancelErr: 'err'}), public_key: key},
        {from: 'node2', lnd: makeLnd({}), public_key: otherKey},
      ],
    }),
    description: 'A failure to cancel the trade on its node is posted',
    expected: {
      answered: 1,
      deleted: 1,
      replies: [{
        options: actions,
        text: [
          '⚠️ Unexpected error `UnexpectedErrorCancelingHodlInvoice`. Try again?',
        ],
      }],
    },
  },
  {
    args: makeArgs({
      nodes: [
        {from: 'node1', lnd: makeLnd({}), public_key: key},
        {
          from: 'node2',
          lnd: makeLnd({createErr: 'err'}),
          public_key: otherKey,
        },
      ],
    }),
    description: 'A failure to create the trade on the selected node is posted',
    expected: {
      answered: 1,
      deleted: 1,
      replies: [{
        options: actions,
        text: ['⚠️ Unexpected error `AddInvoiceError`. Try again?'],
      }],
    },
  },
  {
    args: makeArgs({
      nodes: [
        {
          from: 'node1',
          lnd: makeLnd({invoice: makeInvoice({expiry: '1'})}),
          public_key: key,
        },
        {from: 'node2', lnd: makeLnd({}), public_key: otherKey},
      ],
    }),
    description: 'An expired trade cannot be moved',
    expected: {
      answered: 1,
      deleted: 1,
      replies: [{
        options: actions,
        text: [
          '⚠️ Unexpected error `ExpectedLaterExpiresAtDateToCreateTrade`. Try again?',
        ],
      }],
    },
  },
];

tests.forEach(({args, description, error, expected}) => {
  return test(description, async () => {
    if (!!error) {
      await rejects(moveTradeNode(args), error, 'Got expected error');
    } else {
      await moveTradeNode(args);

      deepEqual(args.ctx.calls, expected, 'Got expected Telegram calls');
    }

    return;
  });
});
