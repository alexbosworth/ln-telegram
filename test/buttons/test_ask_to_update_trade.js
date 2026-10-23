const {deepEqual} = require('node:assert').strict;
const {InlineKeyboard} = require('grammy');
const {rejects} = require('node:assert').strict;
const test = require('node:test');

const askToUpdateTrade = require('./../../buttons/ask_to_update_trade');
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

const makeLnd = ({err, memo}) => {
  return {
    default: {
      lookupInvoice: ({}, cbk) => {
        if (!!err) {
          return cbk(err);
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
          memo: memo || anchor,
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
  };
};

const makeArgs = overrides => {
  const args = {
    command: 'set-trade-description',
    ctx: makeCtx({text: `${title}\n${trade}`}),
    nodes: [{from: 'node1', lnd: makeLnd({}), public_key: key}],
  };

  Object.keys(overrides).forEach(k => args[k] = overrides[k]);

  return args;
};

const tests = [
  {
    args: makeArgs({command: undefined}),
    description: 'A button command is expected',
    error: [400, 'ExpectedButtonCommandToUpdateTradeDetails'],
  },
  {
    args: makeArgs({ctx: undefined}),
    description: 'A Telegram context is expected',
    error: [400, 'ExpectedTelegramContextToUpdateTradeDetails'],
  },
  {
    args: makeArgs({nodes: undefined}),
    description: 'An array of nodes is expected',
    error: [400, 'ExpectedArrayOfNodesToUpdateTradeDetails'],
  },
  {
    args: makeArgs({command: 'command'}),
    description: 'A known button command is expected',
    error: [400, 'ExpectedKnownCommandToUpdateOpenTradeDetails'],
  },
  {
    args: makeArgs({}),
    description: 'A new trade description is asked for',
    expected: {
      answered: 1,
      deleted: 1,
      replies: [{
        options: {
          parse_mode: 'MarkdownV2',
          reply_markup: {
            force_reply: true,
            input_field_placeholder: 'Describe the secret you are selling...',
          },
        },
        text: [
          'Trade\\-Secret: 0\\.00000001 “description” expires 1/1/2026',
          `\`${trade}\``,
          '',
          '_What are you selling?_',
        ],
      }],
    },
  },
  {
    args: makeArgs({command: 'set-trade-expires-at'}),
    description: 'A new trade expiry date is asked for',
    expected: {
      answered: 1,
      deleted: 1,
      replies: [{
        options: {
          parse_mode: 'MarkdownV2',
          reply_markup: {
            force_reply: true,
            input_field_placeholder: 'YYYY-MM-DD',
          },
        },
        text: [
          'Trade\\-Secret: 0\\.00000001 “description” expires 1/1/2026',
          `\`${trade}\``,
          '',
          '_Trade expiry date? \\(YYYY\\-MM\\-DD format\\)_',
        ],
      }],
    },
  },
  {
    args: makeArgs({
      nodes: [
        {from: 'node1', lnd: makeLnd({err: 'err'}), public_key: key},
        {from: 'node2', lnd: makeLnd({}), public_key: otherKey},
      ],
    }),
    description: 'A trade on any of the nodes can be updated',
    expected: {
      answered: 1,
      deleted: 1,
      replies: [{
        options: {
          parse_mode: 'MarkdownV2',
          reply_markup: {
            force_reply: true,
            input_field_placeholder: 'Describe the secret you are selling...',
          },
        },
        text: [
          'Trade\\-Secret: 0\\.00000001 “description” expires 1/1/2026',
          `\`${trade}\``,
          '',
          '_What are you selling?_',
        ],
      }],
    },
  },
  {
    args: makeArgs({ctx: makeCtx({text: ''})}),
    description: 'A trade title is expected on the trade message',
    expected: {
      answered: 1,
      deleted: 0,
      replies: [{
        options: actions,
        text: [
          '⚠️ Unexpected error `ExpectedTradeTitleOnTradeMessage`. Try again?',
        ],
      }],
    },
  },
  {
    args: makeArgs({ctx: makeCtx({text: title})}),
    description: 'An encoded trade is expected on the trade message',
    expected: {
      answered: 1,
      deleted: 0,
      replies: [{
        options: actions,
        text: [
          '⚠️ Unexpected error `ExpectedEncodedTradeOnTradeMessage`. Try again?',
        ],
      }],
    },
  },
  {
    args: makeArgs({ctx: makeCtx({text: `${title}\ntrade`})}),
    description: 'A valid trade is expected on the trade message',
    expected: {
      answered: 1,
      deleted: 0,
      replies: [{
        options: actions,
        text: [
          '⚠️ Unexpected error `ExpectedValidTradeToUpdateTradeDetails`. Try again?',
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
        text: [
          '⚠️ Unexpected error `ExpectedOpenTradeToUpdateTradeDetails`. Try again?',
        ],
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
          '⚠️ Unexpected error `ExpectedTradeIdToUpdateTradeDetails`. Try again?',
        ],
      }],
    },
  },
  {
    args: makeArgs({
      nodes: [{from: 'node1', lnd: makeLnd({memo: 'memo'}), public_key: key}],
    }),
    description: 'A failure to get the trade details is posted',
    expected: {
      answered: 1,
      deleted: 0,
      replies: [{
        options: actions,
        text: ['⚠️ Unexpected error `ExpectedAnchoredTradeData`. Try again?'],
      }],
    },
  },
  {
    args: makeArgs({
      nodes: [{from: 'node1', lnd: makeLnd({err: 'err'}), public_key: key}],
    }),
    description: 'A trade that is not found on a node cannot be updated',
    expected: {
      answered: 1,
      deleted: 0,
      replies: [{
        options: actions,
        text: [
          '⚠️ Unexpected error `FailedToFindRelatedAnchoredTrade`. Try again?',
        ],
      }],
    },
  },
];

tests.forEach(({args, description, error, expected}) => {
  return test(description, async () => {
    if (!!error) {
      await rejects(askToUpdateTrade(args), error, 'Got expected error');
    } else {
      await askToUpdateTrade(args);

      deepEqual(args.ctx.calls, expected, 'Got expected Telegram calls');
    }

    return;
  });
});
