const {deepEqual} = require('node:assert').strict;
const {InlineKeyboard} = require('grammy');
const {rejects} = require('node:assert').strict;
const test = require('node:test');

const handleButtonPush = require('./../../buttons/handle_button_push');
const {key} = require('./../fixtures/encoded');
const {request} = require('./../fixtures/encoded');
const {trade} = require('./../fixtures/encoded');

const anchor = 'anchor-trade-secret:AAZzZWNyZXQBC2Rlc2NyaXB0aW9u';
const invoiceTitle = 'Invoice: 0.00000001 “description”';
const stopTitle = '🤖 Are you sure that you want to stop the bot?';
const tradeTitle = 'Trade-Secret: 0.00000001 “description” expires 1/1/2026';

const makeBot = ({}) => {
  return {
    // Stopping fails so that pushing terminate bot does not exit the process
    stop: async () => {
      throw new Error('FailedToStopBot');
    },
  };
};

const makeCtx = ({data, text}) => {
  const calls = {answered: 0, deleted: 0, edits: [], replies: []};

  return {
    calls,
    answerCallbackQuery: async () => calls.answered++,
    deleteMessage: async () => calls.deleted++,
    editMessageText: async (text, options) => {
      return calls.edits.push({options, text: text.split('\n')});
    },
    reply: async (text, options) => {
      return calls.replies.push({options, text: text.split('\n')});
    },
    update: {
      callback_query: {data, from: {id: 1}, message: {text, entities: []}},
    },
  };
};

const makeLnd = ({}) => {
  const calls = {canceled: 0, created: 0};

  return {
    calls,
    default: {
      addInvoice: ({}, cbk) => {
        calls.created++;

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
      }),
    },
    invoices: {
      cancelInvoice: ({}, cbk) => {
        calls.canceled++;

        return cbk();
      },
    },
  };
};

const makeArgs = overrides => {
  const args = {
    bot: makeBot({}),
    ctx: makeCtx({
      data: 'cancel-invoice',
      text: `${invoiceTitle}\n${request}`,
    }),
    id: 1,
    nodes: [{from: 'node1', lnd: makeLnd({}), public_key: key}],
  };

  Object.keys(overrides).forEach(k => args[k] = overrides[k]);

  return args;
};

const tests = [
  {
    args: makeArgs({bot: undefined}),
    description: 'A Telegram bot is expected',
    error: [400, 'ExpectedTelegramBotToHandleButtonPushEvent'],
  },
  {
    args: makeArgs({ctx: undefined}),
    description: 'A Telegram context is expected',
    error: [400, 'ExpectedTelegramContextToHandleButtonPushEvent'],
  },
  {
    args: makeArgs({id: undefined}),
    description: 'A connected user id is expected',
    error: [400, 'ExpectedConnectedUserIdToHandleButtonPushEvent'],
  },
  {
    args: makeArgs({nodes: undefined}),
    description: 'An array of nodes is expected',
    error: [400, 'ExpectedArrayOfNodesToHandleButtonPushEvent'],
  },
  {
    args: makeArgs({id: 2}),
    description: 'A button pushed by another user is not allowed',
    error: [401, 'CommandRequiresConnectCode'],
  },
  {
    args: makeArgs({}),
    description: 'Pushing cancel on an invoice cancels the invoice',
    expected: {
      ctx: {answered: 1, deleted: 1, edits: [], replies: []},
      lnd: {canceled: 1, created: 0},
    },
  },
  {
    args: makeArgs({
      ctx: makeCtx({data: 'cancel-trade', text: `${tradeTitle}\n${trade}`}),
    }),
    description: 'Pushing cancel on a trade cancels the trade',
    expected: {
      ctx: {answered: 1, deleted: 1, edits: [], replies: []},
      lnd: {canceled: 1, created: 0},
    },
  },
  {
    args: makeArgs({
      ctx: makeCtx({
        data: 'switch-invoice-to-031b84c5567b126440995d3ed5aaba0565d71e18346048',
        text: `${invoiceTitle}\n${request}`,
      }),
    }),
    description: 'Pushing a node on an invoice moves the invoice to the node',
    expected: {
      ctx: {
        answered: 1,
        deleted: 1,
        edits: [],
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
      lnd: {canceled: 1, created: 1},
    },
  },
  {
    args: makeArgs({
      ctx: makeCtx({
        data: 'switch-trade-to-031b84c5567b126440995d3ed5aaba0565d71e18346048',
        text: `${tradeTitle}\n${trade}`,
      }),
    }),
    description: 'Pushing a node on a trade moves the trade to the node',
    expected: {
      ctx: {answered: 1, deleted: 1, edits: [], replies: []},
      lnd: {canceled: 1, created: 1},
    },
  },
  {
    args: makeArgs({ctx: makeCtx({data: 'remove-message', text: stopTitle})}),
    description: 'Pushing remove on a message removes the message',
    expected: {
      ctx: {answered: 1, deleted: 1, edits: [], replies: []},
      lnd: {canceled: 0, created: 0},
    },
  },
  {
    args: makeArgs({
      ctx: makeCtx({
        data: 'set-invoice-description',
        text: `${invoiceTitle}\n${request}`,
      }),
    }),
    description: 'Pushing set memo on an invoice asks for a description',
    expected: {
      ctx: {
        answered: 1,
        deleted: 1,
        edits: [],
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
      lnd: {canceled: 0, created: 0},
    },
  },
  {
    args: makeArgs({
      ctx: makeCtx({
        data: 'set-invoice-node',
        text: `${invoiceTitle}\n${request}`,
      }),
    }),
    description: 'Pushing node on an invoice shows the nodes to move it to',
    expected: {
      ctx: {
        answered: 1,
        deleted: 0,
        edits: [{
          options: {
            entities: [],
            reply_markup: new InlineKeyboard()
              .text('Set Memo', 'set-invoice-description')
              .text('Amount...', 'set-invoice-tokens')
              .text('🗑', 'cancel-invoice')
              .row()
              .text(
                'Node: node1',
                'switch-invoice-to-031b84c5567b126440995d3ed5aaba0565d71e18346048'
              )
              .row(),
          },
          text: [invoiceTitle, request],
        }],
        replies: [],
      },
      lnd: {canceled: 0, created: 0},
    },
  },
  {
    args: makeArgs({
      ctx: makeCtx({
        data: 'set-invoice-tokens',
        text: `${invoiceTitle}\n${request}`,
      }),
    }),
    description: 'Pushing amount on an invoice asks for an amount',
    expected: {
      ctx: {
        answered: 1,
        deleted: 1,
        edits: [],
        replies: [{
          options: {
            parse_mode: 'MarkdownV2',
            reply_markup: {
              force_reply: true,
              input_field_placeholder: 'Enter amount to invoice...',
            },
          },
          text: [
            'Invoice: 0\\.00000001 “description”',
            `\`${request}\``,
            '',
            '_How much should this invoice be for?_',
          ],
        }],
      },
      lnd: {canceled: 0, created: 0},
    },
  },
  {
    args: makeArgs({
      ctx: makeCtx({
        data: 'set-trade-description',
        text: `${tradeTitle}\n${trade}`,
      }),
    }),
    description: 'Pushing set description on a trade asks for a description',
    expected: {
      ctx: {
        answered: 1,
        deleted: 1,
        edits: [],
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
      lnd: {canceled: 0, created: 0},
    },
  },
  {
    args: makeArgs({
      ctx: makeCtx({
        data: 'set-trade-expires-at',
        text: `${tradeTitle}\n${trade}`,
      }),
    }),
    description: 'Pushing expiry on a trade asks for an expiry date',
    expected: {
      ctx: {
        answered: 1,
        deleted: 1,
        edits: [],
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
      lnd: {canceled: 0, created: 0},
    },
  },
  {
    args: makeArgs({
      ctx: makeCtx({data: 'set-trade-node', text: `${tradeTitle}\n${trade}`}),
    }),
    description: 'Pushing node on a trade shows the nodes to move it to',
    expected: {
      ctx: {
        answered: 1,
        deleted: 0,
        edits: [{
          options: {
            entities: [],
            reply_markup: new InlineKeyboard()
              .text('Set Description', 'set-trade-description')
              .text('Expiry...', 'set-trade-expires-at')
              .text('🗑', 'cancel-trade')
              .row()
              .text(
                'Node: node1',
                'switch-trade-to-031b84c5567b126440995d3ed5aaba0565d71e18346048'
              ),
          },
          text: [tradeTitle, trade],
        }],
        replies: [],
      },
      lnd: {canceled: 0, created: 0},
    },
  },
  {
    args: makeArgs({ctx: makeCtx({data: 'terminate-bot', text: stopTitle})}),
    description: 'Pushing stop bot stops the bot',
    error: new Error('FailedToStopBot'),
  },
  {
    args: makeArgs({ctx: makeCtx({data: 'unknown', text: stopTitle})}),
    description: 'Pushing an unknown button posts a warning',
    expected: {
      ctx: {
        answered: 1,
        deleted: 0,
        edits: [],
        replies: [{
          options: {
            parse_mode: 'Markdown',
            reply_markup: new InlineKeyboard().text('OK', 'remove-message'),
          },
          text: [
            '🤖 Unexpected button pushed. This button may no longer be supported?',
          ],
        }],
      },
      lnd: {canceled: 0, created: 0},
    },
  },
];

tests.forEach(({args, description, error, expected}) => {
  return test(description, async () => {
    if (!!error) {
      await rejects(handleButtonPush(args), error, 'Got expected error');
    } else {
      await handleButtonPush(args);

      const res = {ctx: args.ctx.calls, lnd: args.nodes[0].lnd.calls};

      deepEqual(res, expected, 'Got expected result');
    }

    return;
  });
});
