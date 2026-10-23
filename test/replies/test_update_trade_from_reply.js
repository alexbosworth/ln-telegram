const {deepEqual} = require('node:assert').strict;
const {InlineKeyboard} = require('grammy');
const {rejects} = require('node:assert').strict;
const {Settings} = require('luxon');
const test = require('node:test');

const {getInfoResponse} = require('./../fixtures');
const method = require('./../../replies/update_trade_from_reply');
const {key} = require('./../fixtures/encoded');
const {request} = require('./../fixtures/encoded');
const {nodeTrade: trade} = require('./../fixtures/encoded');

// Anchored trade data: secret “secret” with description “description”
const anchor = 'anchor-trade-secret:AAZzZWNyZXQBC2Rlc2NyaXB0aW9u';
const getInfoRes = () => JSON.parse(JSON.stringify(getInfoResponse));
const join = lines => lines.join('\n');
const nearestMinute = ms => new Date(Math.round(ms / 6e4) * 6e4).toISOString();
// Anchored trade data: secret “secret” with description “new description”
const newAnchor = 'anchor-trade-secret:AAZzZWNyZXQBD25ldyBkZXNjcmlwdGlvbg==';
const otherKey = Buffer.alloc(33, 2).toString('hex');
const tradeId = Buffer.alloc(32).toString('hex');

// The expiry date is parsed and shown in the default zone and locale
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

// The answer is message 4, a reply to the question in message 3
const makeCtx = ({answer, attachment, question}) => {
  const deleted = [];
  const replies = [];

  const message = {
    chat: {id: 1},
    from: {id: 1},
    message_id: 4,
    reply_to_message: {
      chat: {id: 1},
      message_id: 3,
      text: join([
        'Trade-Secret: 0.00000001 “description” expires 1/1/2100',
        trade,
        '',
        question || 'What are you selling?',
      ]),
    },
  };

  if (!!attachment) {
    message[attachment] = attachment === 'photo' ?
      [{file_id: 'file'}] : {file_id: 'file'};
  } else {
    message.text = answer || 'new description';
  }

  return {
    deleted,
    message,
    replies,
    deleteMessage: async () => {
      return deleted.push({chat: message.chat.id, id: message.message_id});
    },
    reply: async (text, options) => {
      return replies.push({options, text: text.split('\n')});
    },
    update: {message},
  };
};

// The node has an anchored trade that expires at 2100-01-01
const makeLnd = ({addErr, cancelErr, lookupErr, memo}) => {
  const canceled = [];
  const created = [];

  return {
    canceled,
    created,
    default: {
      addInvoice: (args, cbk) => {
        if (!!addErr) {
          return cbk(addErr);
        }

        // The expiry is seconds from the real time, so turn it back into a
        // date to the nearest minute
        const expiresAt = new Date().getTime() + args.expiry * 1000;

        created.push({
          expires_at: nearestMinute(expiresAt),
          memo: args.memo,
          value_msat: args.value_msat,
        });

        return cbk(null, {
          payment_addr: Buffer.alloc(32),
          payment_request: request,
        });
      },
      getInfo: ({}, cbk) => cbk(null, getInfoRes()),
      lookupInvoice: ({}, cbk) => {
        if (!!lookupErr) {
          return cbk(lookupErr);
        }

        return cbk(null, {
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
    api: makeApi({}),
    ctx: makeCtx({}),
    id: 1,
    nodes: [{from: 'node1', lnd: makeLnd({}), public_key: key}],
  };

  Object.keys(overrides).forEach(k => args[k] = overrides[k]);

  return args;
};

const tests = [
  {
    args: makeArgs({api: undefined}),
    description: 'A Telegram API object is expected',
    error: [400, 'ExpectedTelegramApiToUpdateTradeFromReply'],
  },
  {
    args: makeArgs({ctx: undefined}),
    description: 'A Telegram context is expected',
    error: [400, 'ExpectedTelegramContextToUpdateTradeFromReply'],
  },
  {
    args: makeArgs({id: undefined}),
    description: 'A connected user id is expected',
    error: [400, 'ExpectedConnectedUserIdToUpdateTradeFromReply'],
  },
  {
    args: makeArgs({nodes: undefined}),
    description: 'An array of nodes is expected',
    error: [400, 'ExpectedArrayOfNodesToUpdateTradeFromReply'],
  },
  {
    args: makeArgs({id: 2}),
    description: 'Only the connected user can update a trade',
    error: [401, 'CommandRequiresConnectCode'],
  },
  {
    args: makeArgs({}),
    description: 'The trade description is updated',
    expected: {
      deleted: [{chat: 1, id: 4}, {chat: 1, id: 3}],
      messages: [],
      nodes: [{
        canceled: [tradeId],
        created: [{
          expires_at: '2100-01-01T00:00:00.000Z',
          memo: newAnchor,
          value_msat: '1000',
        }],
      }],
      replies: [],
    },
  },
  {
    args: makeArgs({
      ctx: makeCtx({
        answer: '2100-06-01',
        question: 'Trade expiry date? (YYYY-MM-DD format)',
      }),
    }),
    description: 'The trade expiry date is updated',
    expected: {
      deleted: [{chat: 1, id: 4}, {chat: 1, id: 3}],
      messages: [],
      nodes: [{
        canceled: [tradeId],
        created: [{
          expires_at: '2100-06-01T00:00:00.000Z',
          memo: anchor,
          value_msat: '1000',
        }],
      }],
      replies: [],
    },
  },
  {
    args: makeArgs({
      ctx: makeCtx({
        answer: 'invalid',
        question: 'Trade expiry date? (YYYY-MM-DD format)',
      }),
    }),
    description: 'An invalid expiry date fails and the trade is posted again',
    expected: {
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
      nodes: [{canceled: [], created: []}],
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
    args: makeArgs({
      ctx: makeCtx({
        answer: '1969-12-31',
        question: 'Trade expiry date? (YYYY-MM-DD format)',
      }),
    }),
    description: 'A past expiry date fails and the trade is posted again',
    expected: {
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
      nodes: [{canceled: [], created: []}],
      replies: [{
        options: {
          parse_mode: 'Markdown',
          reply_markup: new InlineKeyboard().text('OK', 'remove-message'),
        },
        text: [
          '⚠️ Failed to update trade: ExpectedFutureDateToSetTradeExpiryAt.',
        ],
      }],
    },
  },
  {
    args: makeArgs({
      nodes: [
        {
          from: 'node2',
          lnd: makeLnd({lookupErr: 'err'}),
          public_key: otherKey,
        },
        {from: 'node1', lnd: makeLnd({}), public_key: key},
      ],
    }),
    description: 'The trade is updated on the node that has it',
    expected: {
      deleted: [{chat: 1, id: 4}, {chat: 1, id: 3}],
      messages: [],
      nodes: [
        {canceled: [], created: []},
        {
          canceled: [tradeId],
          created: [{
            expires_at: '2100-01-01T00:00:00.000Z',
            memo: newAnchor,
            value_msat: '1000',
          }],
        },
      ],
      replies: [],
    },
  },
  {
    args: makeArgs({
      nodes: [
        {from: 'node1', lnd: makeLnd({lookupErr: 'err'}), public_key: key},
      ],
    }),
    description: 'A trade not found on any node is posted as a failure',
    expected: {
      deleted: [{chat: 1, id: 4}, {chat: 1, id: 3}],
      messages: [],
      nodes: [{canceled: [], created: []}],
      replies: [{
        options: {
          parse_mode: 'Markdown',
          reply_markup: new InlineKeyboard().text('OK', 'remove-message'),
        },
        text: ['⚠️ Failed to update trade: CannotFindAnchoredTradeForId.'],
      }],
    },
  },
  {
    args: makeArgs({
      nodes: [
        {from: 'node1', lnd: makeLnd({memo: 'description'}), public_key: key},
      ],
    }),
    description: 'A failure to get the trade is posted',
    expected: {
      deleted: [{chat: 1, id: 4}, {chat: 1, id: 3}],
      messages: [],
      nodes: [{canceled: [], created: []}],
      replies: [{
        options: {
          parse_mode: 'Markdown',
          reply_markup: new InlineKeyboard().text('OK', 'remove-message'),
        },
        text: ['⚠️ Failed to update trade: ExpectedAnchoredTradeData.'],
      }],
    },
  },
  {
    args: makeArgs({
      nodes: [
        {from: 'node1', lnd: makeLnd({cancelErr: 'err'}), public_key: key},
      ],
    }),
    description: 'A trade that cannot be removed fails and is posted again',
    expected: {
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
      nodes: [{canceled: [tradeId], created: []}],
      replies: [{
        options: {
          parse_mode: 'Markdown',
          reply_markup: new InlineKeyboard().text('OK', 'remove-message'),
        },
        text: [
          '⚠️ Failed to update trade: UnexpectedErrorCancelingHodlInvoice.',
        ],
      }],
    },
  },
  ...['sticker', 'photo', 'voice'].map(attachment => ({
    args: makeArgs({ctx: makeCtx({attachment})}),
    description: `A ${attachment} cannot update a trade description`,
    expected: {
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
      nodes: [{canceled: [], created: []}],
      replies: [{
        options: {
          parse_mode: 'Markdown',
          reply_markup: new InlineKeyboard().text('OK', 'remove-message'),
        },
        text: [
          '⚠️ Failed to update trade: ExpectedTextToUpdateTradeDescription.',
        ],
      }],
    },
  })),
  {
    args: makeArgs({ctx: makeCtx({answer: 'a'.repeat(101)})}),
    description: 'A long description fails and the trade is posted again',
    expected: {
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
      nodes: [{canceled: [], created: []}],
      replies: [{
        options: {
          parse_mode: 'Markdown',
          reply_markup: new InlineKeyboard().text('OK', 'remove-message'),
        },
        text: [
          '⚠️ Failed to update trade: ExpectedShorterDescriptionForTrade.',
        ],
      }],
    },
  },
  {
    args: makeArgs({
      nodes: [{from: 'node1', lnd: makeLnd({addErr: 'err'}), public_key: key}],
    }),
    description: 'A failure to recreate a removed trade is posted',
    expected: {
      deleted: [{chat: 1, id: 4}, {chat: 1, id: 3}],
      messages: [],
      nodes: [{canceled: [tradeId], created: []}],
      replies: [{
        options: {
          parse_mode: 'Markdown',
          reply_markup: new InlineKeyboard().text('OK', 'remove-message'),
        },
        text: ['⚠️ Failed to update trade: AddInvoiceError.'],
      }],
    },
  },
  {
    args: makeArgs({ctx: makeCtx({question: 'Unknown question?'})}),
    description: 'A reply that is not a trade question is ignored',
    expected: {
      deleted: [],
      messages: [],
      nodes: [{canceled: [], created: []}],
      replies: [],
    },
  },
];

tests.forEach(({args, description, error, expected}) => {
  return test(description, async () => {
    if (!!error) {
      await rejects(method(args), error, 'Got expected error');
    } else {
      await method(args);

      const res = {
        deleted: [...args.ctx.deleted, ...args.api.deleted],
        messages: args.api.messages,
        nodes: args.nodes.map(({lnd}) => {
          return {canceled: lnd.canceled, created: lnd.created};
        }),
        replies: args.ctx.replies,
      };

      deepEqual(res, expected, 'Got expected result');
    }

    return;
  });
});
