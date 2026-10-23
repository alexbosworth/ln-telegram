const {deepEqual} = require('node:assert').strict;
const {InlineKeyboard} = require('grammy');
const {rejects} = require('node:assert').strict;
const test = require('node:test');

const {getInfoResponse} = require('./../fixtures');
const method = require('./../../replies/update_invoice_from_reply');
const {key} = require('./../fixtures/encoded');
const {request} = require('./../fixtures/encoded');

const getInfoRes = () => JSON.parse(JSON.stringify(getInfoResponse));
const id = Buffer.alloc(32).toString('hex');
const join = lines => lines.join('\n');
const otherKey = Buffer.alloc(33, 2).toString('hex');
const rates = {eur: {value: 50000}, usd: {value: 100000}};

const makeApi = ({err}) => {
  const deleted = [];

  return {
    deleted,
    deleteMessage: async (chat, id) => {
      deleted.push({chat, id});

      if (!!err) {
        throw new Error(err);
      }

      return;
    },
  };
};

// The answer is message 4, a reply to the question in message 3
const makeCtx = ({answer, attachment, deleteErr, question, replyErr}) => {
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
        'Invoice: 0.00000001 “description”',
        request,
        '',
        question || 'What is this invoice for?',
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
      deleted.push({chat: message.chat.id, id: message.message_id});

      if (!!deleteErr) {
        throw new Error(deleteErr);
      }

      return;
    },
    reply: async (text, options) => {
      replies.push({options, text: text.split('\n')});

      if (!!replyErr) {
        throw new Error(replyErr);
      }

      return;
    },
    update: {message},
  };
};

// Every invoice the node creates comes back as the 1 sat “description” request
const makeLnd = ({addErr, cancelErr, lookupErr, settled}) => {
  const canceled = [];
  const created = [];

  return {
    canceled,
    created,
    default: {
      addInvoice: ({memo, value_msat}, cbk) => {
        created.push({memo, value_msat});

        if (!!addErr) {
          return cbk(addErr);
        }

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
    api: makeApi({}),
    ctx: makeCtx({}),
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
    error: [400, 'ExpectedTelegramApiToUpdateInvoice'],
  },
  {
    args: makeArgs({ctx: undefined}),
    description: 'A Telegram context is expected',
    error: [400, 'ExpectedTelegramContextToUpdateInvoice'],
  },
  {
    args: makeArgs({id: undefined}),
    description: 'A connected user id is expected',
    error: [400, 'ExpectedConnectedUserIdToUpdateInvoice'],
  },
  {
    args: makeArgs({nodes: undefined}),
    description: 'An array of nodes is expected',
    error: [400, 'ExpectedArrayOfNodesToUpdateInvoice'],
  },
  {
    args: makeArgs({request: undefined}),
    description: 'A request function is expected',
    error: [400, 'ExpectedRequestFunctionToUpdateInvoice'],
  },
  {
    args: makeArgs({id: 2}),
    description: 'Only the connected user can update an invoice',
    error: [401, 'CommandRequiresConnectCode'],
  },
  {
    args: makeArgs({}),
    description: 'The invoice description is updated',
    expected: {
      canceled: [id],
      created: [{memo: 'new description', value_msat: '1000'}],
      deleted: [{chat: 1, id: 4}, {chat: 1, id: 3}],
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
        answer: '2',
        question: 'How much should this invoice be for?',
      }),
    }),
    description: 'The invoice amount is updated',
    expected: {
      canceled: [id],
      created: [{memo: 'description', value_msat: '2000'}],
      deleted: [{chat: 1, id: 4}, {chat: 1, id: 3}],
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
        answer: '1*USD',
        question: 'How much should this invoice be for?',
      }),
    }),
    description: 'The invoice amount is updated with a fiat amount',
    expected: {
      canceled: [id],
      created: [{memo: 'description', value_msat: '1000000'}],
      deleted: [{chat: 1, id: 4}, {chat: 1, id: 3}],
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
        answer: 'invalid',
        question: 'How much should this invoice be for?',
      }),
    }),
    description: 'An invalid amount fails and the invoice is posted again',
    expected: {
      canceled: [],
      created: [],
      deleted: [{chat: 1, id: 4}, {chat: 1, id: 3}],
      replies: [
        {
          options: {
            parse_mode: 'Markdown',
            reply_markup: new InlineKeyboard().text('OK', 'remove-message'),
          },
          text: ['FailedToParseAmount'],
        },
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
      ],
    },
  },
  {
    args: makeArgs({
      ctx: makeCtx({
        answer: '-1',
        question: 'How much should this invoice be for?',
      }),
    }),
    description: 'A negative amount fails before the invoice is canceled',
    expected: {
      canceled: [],
      created: [],
      deleted: [{chat: 1, id: 4}, {chat: 1, id: 3}],
      replies: [
        {
          options: {
            parse_mode: 'Markdown',
            reply_markup: new InlineKeyboard().text('OK', 'remove-message'),
          },
          text: ['ExpectedValidAmountToUpdateInvoice'],
        },
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
      ],
    },
  },
  {
    args: makeArgs({
      ctx: makeCtx({
        answer: '9007199254740993',
        question: 'How much should this invoice be for?',
      }),
    }),
    description: 'A huge amount fails before the invoice is canceled',
    expected: {
      canceled: [],
      created: [],
      deleted: [{chat: 1, id: 4}, {chat: 1, id: 3}],
      replies: [
        {
          options: {
            parse_mode: 'Markdown',
            reply_markup: new InlineKeyboard().text('OK', 'remove-message'),
          },
          text: ['ExpectedValidAmountToUpdateInvoice'],
        },
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
      ],
    },
  },
  {
    args: makeArgs({
      ctx: makeCtx({
        answer: '10000000000001',
        question: 'How much should this invoice be for?',
      }),
    }),
    description: 'An amount above the LND limit leaves the invoice intact',
    expected: {
      canceled: [],
      created: [],
      deleted: [{chat: 1, id: 4}, {chat: 1, id: 3}],
      replies: [
        {
          options: {
            parse_mode: 'Markdown',
            reply_markup: new InlineKeyboard().text('OK', 'remove-message'),
          },
          text: ['ExpectedValidAmountToUpdateInvoice'],
        },
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
      ],
    },
  },
  {
    args: makeArgs({
      ctx: makeCtx({
        answer: '10000000000000',
        question: 'How much should this invoice be for?',
      }),
    }),
    description: 'The maximum LND invoice amount is accepted',
    expected: {
      canceled: [id],
      created: [{memo: 'description', value_msat: '10000000000000000'}],
      deleted: [{chat: 1, id: 4}, {chat: 1, id: 3}],
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
        answer: '0',
        question: 'How much should this invoice be for?',
      }),
    }),
    description: 'An amount of zero updates the invoice to any amount',
    expected: {
      canceled: [id],
      created: [{memo: 'description', value_msat: '0'}],
      deleted: [{chat: 1, id: 4}, {chat: 1, id: 3}],
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
  ...['sticker', 'photo', 'voice'].flatMap(attachment => [
    {
      args: makeArgs({ctx: makeCtx({attachment})}),
      description: `A ${attachment} cannot update an invoice description`,
      expected: {
        canceled: [],
        created: [],
        deleted: [{chat: 1, id: 4}, {chat: 1, id: 3}],
        replies: [
          {
            options: {
              parse_mode: 'Markdown',
              reply_markup: new InlineKeyboard().text('OK', 'remove-message'),
            },
            text: ['ExpectedTextToUpdateInvoiceDescription'],
          },
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
        ],
      },
    },
    {
      args: makeArgs({
        ctx: makeCtx({
          attachment,
          question: 'How much should this invoice be for?',
        }),
      }),
      description: `A ${attachment} cannot update an invoice amount`,
      expected: {
        canceled: [],
        created: [],
        deleted: [{chat: 1, id: 4}, {chat: 1, id: 3}],
        replies: [
          {
            options: {
              parse_mode: 'Markdown',
              reply_markup: new InlineKeyboard().text('OK', 'remove-message'),
            },
            text: ['ExpectedTextToUpdateInvoiceAmount'],
          },
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
        ],
      },
    },
  ]),
  {
    args: makeArgs({ctx: makeCtx({answer: 'a'.repeat(640)})}),
    description: 'A description over 639 bytes fails before canceling',
    expected: {
      canceled: [],
      created: [],
      deleted: [{chat: 1, id: 4}, {chat: 1, id: 3}],
      replies: [
        {
          options: {
            parse_mode: 'Markdown',
            reply_markup: new InlineKeyboard().text('OK', 'remove-message'),
          },
          text: ['ExpectedShorterDescriptionToUpdateInvoice'],
        },
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
      ],
    },
  },
  {
    args: makeArgs({ctx: makeCtx({answer: '€'.repeat(214)})}),
    description: 'A description is limited by bytes, not characters',
    expected: {
      canceled: [],
      created: [],
      deleted: [{chat: 1, id: 4}, {chat: 1, id: 3}],
      replies: [
        {
          options: {
            parse_mode: 'Markdown',
            reply_markup: new InlineKeyboard().text('OK', 'remove-message'),
          },
          text: ['ExpectedShorterDescriptionToUpdateInvoice'],
        },
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
      ],
    },
  },
  {
    args: makeArgs({ctx: makeCtx({answer: 'a'.repeat(639)})}),
    description: 'A description of 639 bytes updates the invoice',
    expected: {
      canceled: [id],
      created: [{memo: 'a'.repeat(639), value_msat: '1000'}],
      deleted: [{chat: 1, id: 4}, {chat: 1, id: 3}],
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
      nodes: [{from: 'node1', lnd: makeLnd({}), public_key: otherKey}],
    }),
    description: 'A reply about an invoice from another node is ignored',
    expected: {canceled: [], created: [], deleted: [], replies: []},
  },
  {
    args: makeArgs({
      api: makeApi({err: 'err'}),
      ctx: makeCtx({deleteErr: 'err'}),
    }),
    description: 'Errors deleting the question and answer are ignored',
    expected: {
      canceled: [id],
      created: [{memo: 'new description', value_msat: '1000'}],
      deleted: [{chat: 1, id: 4}, {chat: 1, id: 3}],
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
        answer: 'invalid',
        question: 'How much should this invoice be for?',
        replyErr: 'err',
      }),
    }),
    description: 'Errors posting failures are ignored',
    expected: {
      canceled: [],
      created: [],
      deleted: [{chat: 1, id: 4}, {chat: 1, id: 3}],
      replies: [
        {
          options: {
            parse_mode: 'Markdown',
            reply_markup: new InlineKeyboard().text('OK', 'remove-message'),
          },
          text: ['FailedToParseAmount'],
        },
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
      ],
    },
  },
  {
    args: makeArgs({
      nodes: [
        {from: 'node1', lnd: makeLnd({cancelErr: 'err'}), public_key: key},
        {from: 'node2', lnd: makeLnd({}), public_key: otherKey},
      ],
    }),
    description: 'A failure to cancel fails and the invoice is posted again',
    expected: {
      canceled: [id],
      created: [],
      deleted: [{chat: 1, id: 4}, {chat: 1, id: 3}],
      replies: [
        {
          options: {
            parse_mode: 'Markdown',
            reply_markup: new InlineKeyboard().text('OK', 'remove-message'),
          },
          text: ['UnexpectedErrorCancelingHodlInvoice'],
        },
        {
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
        },
      ],
    },
  },
  {
    args: makeArgs({
      nodes: [{
        from: 'node1',
        lnd: makeLnd({
          cancelErr: {details: 'invoice already settled'},
          settled: true,
        }),
        public_key: key,
      }],
    }),
    description: 'A paid invoice is not updated or posted again',
    expected: {
      canceled: [id],
      created: [],
      deleted: [{chat: 1, id: 4}, {chat: 1, id: 3}],
      replies: [{
        options: {
          parse_mode: 'Markdown',
          reply_markup: new InlineKeyboard().text('OK', 'remove-message'),
        },
        text: ['⚠️ _Invoice already paid, so it cannot be changed._'],
      }],
    },
  },
  {
    args: makeArgs({
      nodes: [{
        from: 'node1',
        lnd: makeLnd({cancelErr: 'err', lookupErr: 'err'}),
        public_key: key,
      }],
    }),
    description: 'A failure to cancel an invoice that is not found is posted',
    expected: {
      canceled: [id],
      created: [],
      deleted: [{chat: 1, id: 4}, {chat: 1, id: 3}],
      replies: [
        {
          options: {
            parse_mode: 'Markdown',
            reply_markup: new InlineKeyboard().text('OK', 'remove-message'),
          },
          text: ['UnexpectedErrorCancelingHodlInvoice'],
        },
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
      ],
    },
  },
  {
    args: makeArgs({
      nodes: [{from: 'node1', lnd: makeLnd({addErr: 'err'}), public_key: key}],
    }),
    description: 'A failure to create the updated invoice is posted',
    expected: {
      canceled: [id],
      created: [{memo: 'new description', value_msat: '1000'}],
      deleted: [{chat: 1, id: 4}, {chat: 1, id: 3}],
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
      await rejects(method(args), error, 'Got expected error');
    } else {
      await method(args);

      const [{lnd}] = args.nodes;

      const res = {
        canceled: lnd.canceled,
        created: lnd.created,
        deleted: [...args.ctx.deleted, ...args.api.deleted],
        replies: args.ctx.replies,
      };

      deepEqual(res, expected, 'Got expected result');
    }

    return;
  });
});
