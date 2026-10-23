const {deepEqual} = require('node:assert').strict;
const {InlineKeyboard} = require('grammy');
const {rejects} = require('node:assert').strict;
const {Settings} = require('luxon');
const test = require('node:test');

const {getInfoResponse} = require('./../fixtures');
const {actOnMessageReply} = require('./../../replies');
const {key} = require('./../fixtures/encoded');
const {request} = require('./../fixtures/encoded');
const {nodeTrade: trade} = require('./../fixtures/encoded');

// Anchored trade data: secret “secret” with description “description”
const anchor = 'anchor-trade-secret:AAZzZWNyZXQBC2Rlc2NyaXB0aW9u';
const getInfoRes = () => JSON.parse(JSON.stringify(getInfoResponse));
const invoiceId = Buffer.alloc(32).toString('hex');
const invoiceTitle = 'Invoice: 0.00000001 “description”';
const join = lines => lines.join('\n');
// Anchored trade data: secret “secret” with description “new description”
const newAnchor = 'anchor-trade-secret:AAZzZWNyZXQBD25ldyBkZXNjcmlwdGlvbg==';
const rates = {eur: {value: 50000}, usd: {value: 100000}};
const tradeId = Buffer.alloc(32).toString('hex');
const tradeTitle = 'Trade-Secret: 0.00000001 “description” expires 1/1/2100';

// The trade expiry date is shown in the default locale and zone, so pin those
Settings.defaultLocale = 'en-US';
Settings.defaultZone = 'utc';

const makeApi = ({}) => {
  const deleted = [];
  const messages = [];

  return {
    deleted,
    messages,
    deleteMessage: async (chat, id) => deleted.push({chat, id}),
    sendMessage: async (user, text, options) => {
      return messages.push({options, user, text: text.split('\n')});
    },
  };
};

const makeCtx = ({update}) => {
  const deleted = [];
  const replies = [];

  return {
    deleted,
    replies,
    update,
    deleteMessage: async () => {
      const {chat, message_id} = update.message;

      return deleted.push({chat: chat.id, id: message_id});
    },
    message: !update ? undefined : update.message,
    reply: async (text, options) => {
      return replies.push({options, text: text.split('\n')});
    },
  };
};

// Every invoice lookup finds an anchored trade that expires at 2100-01-01
const makeLnd = ({}) => {
  const canceled = [];
  const created = [];

  return {
    canceled,
    created,
    default: {
      addInvoice: ({memo, value_msat}, cbk) => {
        created.push({memo, value_msat});

        return cbk(null, {
          payment_addr: Buffer.alloc(32),
          payment_request: request,
        });
      },
      getInfo: ({}, cbk) => cbk(null, getInfoRes()),
      lookupInvoice: ({}, cbk) => cbk(null, {
        add_index: '1',
        amt_paid_msat: '0',
        amt_paid_sat: '0',
        cltv_expiry: '18',
        creation_date: '0',
        description_hash: Buffer.alloc(0),
        expiry: '4102444800',
        fallback_addr: '',
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
      }),
    },
    invoices: {
      cancelInvoice: ({payment_hash}, cbk) => {
        canceled.push(payment_hash.toString('hex'));

        return cbk();
      },
    },
  };
};

// The answer is message 4, a reply to the question in message 3
const makeUpdate = ({answer, question}) => {
  return {
    message: {
      chat: {id: 1},
      from: {id: 1},
      message_id: 4,
      reply_to_message: {chat: {id: 1}, message_id: 3, text: question},
      text: answer,
    },
  };
};

const makeArgs = overrides => {
  const args = {
    api: makeApi({}),
    ctx: makeCtx({
      update: makeUpdate({
        answer: 'new description',
        question: join([
          invoiceTitle,
          request,
          '',
          'What is this invoice for?',
        ]),
      }),
    }),
    id: 1,
    nodes: [{from: 'node1', lnd: makeLnd({}), public_key: key}],
    request: ({}, cbk) => cbk(null, {statusCode: 200}, {rates}),
  };

  Object.keys(overrides).forEach(k => args[k] = overrides[k]);

  return args;
};

const tests = [
  {
    args: makeArgs({api: undefined}),
    description: 'A Telegram API object is expected',
    error: [400, 'ExpectedTelegramApiToActOnMessageReply'],
  },
  {
    args: makeArgs({ctx: undefined}),
    description: 'A Telegram context is expected',
    error: [400, 'ExpectedTelegramContextToActOnMessageReply'],
  },
  {
    args: makeArgs({id: undefined}),
    description: 'A connected user id is expected',
    error: [400, 'ExpectedConnectedUserIdToActOnMessageReply'],
  },
  {
    args: makeArgs({nodes: undefined}),
    description: 'An array of nodes is expected',
    error: [400, 'ExpectedArrayOfNodesToActOnMessageReply'],
  },
  {
    args: makeArgs({request: undefined}),
    description: 'A request function is expected',
    error: [400, 'ExpectedRequestFunctionToActOnMessageReply'],
  },
  {
    args: makeArgs({ctx: makeCtx({})}),
    description: 'A context without an update is ignored',
    expected: {
      canceled: [],
      created: [],
      deleted: [],
      messages: [],
      replies: [],
    },
  },
  {
    args: makeArgs({ctx: makeCtx({update: {}})}),
    description: 'An update without a message is ignored',
    expected: {
      canceled: [],
      created: [],
      deleted: [],
      messages: [],
      replies: [],
    },
  },
  {
    args: makeArgs({ctx: makeCtx({update: {message: {text: 'text'}}})}),
    description: 'A message that is not a reply is ignored',
    expected: {
      canceled: [],
      created: [],
      deleted: [],
      messages: [],
      replies: [],
    },
  },
  {
    args: makeArgs({ctx: makeCtx({update: makeUpdate({answer: 'text'})})}),
    description: 'A reply to a message without text is ignored',
    expected: {
      canceled: [],
      created: [],
      deleted: [],
      messages: [],
      replies: [],
    },
  },
  {
    args: makeArgs({
      ctx: makeCtx({update: makeUpdate({answer: 'text', question: 'text'})}),
    }),
    description: 'A reply to a message that is not a question is ignored',
    expected: {
      canceled: [],
      created: [],
      deleted: [],
      messages: [],
      replies: [],
    },
  },
  {
    args: makeArgs({}),
    description: 'A reply with a new invoice description updates the invoice',
    expected: {
      canceled: [invoiceId],
      created: [{memo: 'new description', value_msat: '1000'}],
      deleted: [{chat: 1, id: 4}, {chat: 1, id: 3}],
      messages: [],
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
      ctx: makeCtx({
        update: makeUpdate({
          answer: '1*USD',
          question: join([
            invoiceTitle,
            request,
            '',
            'How much should this invoice be for?',
          ]),
        }),
      }),
    }),
    description: 'A reply with a new invoice amount updates the invoice',
    expected: {
      canceled: [invoiceId],
      created: [{memo: 'description', value_msat: '1000000'}],
      deleted: [{chat: 1, id: 4}, {chat: 1, id: 3}],
      messages: [],
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
      ctx: makeCtx({
        update: makeUpdate({
          answer: 'new description',
          question: join([tradeTitle, trade, '', 'What are you selling?']),
        }),
      }),
    }),
    description: 'A reply with a new trade description updates the trade',
    expected: {
      canceled: [tradeId],
      created: [{memo: newAnchor, value_msat: '1000'}],
      deleted: [{chat: 1, id: 4}, {chat: 1, id: 3}],
      messages: [],
      replies: [],
    },
  },
  {
    args: makeArgs({
      ctx: makeCtx({
        update: makeUpdate({
          answer: 'invalid',
          question: join([
            tradeTitle,
            trade,
            '',
            'Trade expiry date? (YYYY-MM-DD format)',
          ]),
        }),
      }),
    }),
    description: 'A reply with an invalid trade expiry date posts a failure',
    expected: {
      canceled: [],
      created: [],
      deleted: [{chat: 1, id: 4}, {chat: 1, id: 3}],
      messages: [{
        options: {
          parse_mode: 'MarkdownV2',
          reply_markup: new InlineKeyboard()
            .text('Set Description', 'set-trade-description')
            .text('Expiry...', 'set-trade-expires-at')
            .text('🗑', 'cancel-trade'),
        },
        text: [
          'Trade\\-Secret: 0\\.00000001 “description” expires 1/1/2100',
          `\`${trade}\``,
        ],
        user: 1,
      }],
      replies: [{
        options: {
          parse_mode: 'Markdown',
          reply_markup: new InlineKeyboard().text('OK', 'remove-message'),
        },
        text: [
          '⚠️ Failed to update trade: ExpectedValidDateToSetTradeExpiresAt.',
        ],
      }],
    },
  },
  {
    args: makeArgs({id: 2}),
    description: 'An error acting on the reply is passed back',
    error: [401, 'CommandRequiresConnectCode'],
  },
];

tests.forEach(({args, description, error, expected}) => {
  return test(description, async () => {
    if (!!error) {
      await rejects(actOnMessageReply(args), error, 'Got expected error');
    } else {
      await actOnMessageReply(args);

      const [{lnd}] = args.nodes;

      const res = {
        canceled: lnd.canceled,
        created: lnd.created,
        deleted: [...args.ctx.deleted, ...args.api.deleted],
        messages: args.api.messages,
        replies: args.ctx.replies,
      };

      deepEqual(res, expected, 'Got expected result');
    }

    return;
  });
});
