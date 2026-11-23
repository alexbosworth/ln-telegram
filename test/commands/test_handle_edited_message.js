const {deepEqual} = require('node:assert').strict;
const {InlineKeyboard} = require('grammy');
const {rejects} = require('node:assert').strict;
const test = require('node:test');

const {handleEditedMessage} = require('./../../');

const nowSeconds = () => Math.floor(Date.now() / 1e3);

const makeCtx = ({update}) => {
  const replies = [];

  return {
    replies,
    update,
    reply: async (text, options) => replies.push({options, text}),
  };
};

const makeArgs = overrides => {
  const args = {
    ctx: makeCtx({
      update: {
        edited_message: {
          get date() {
            return nowSeconds();
          },
          from: {id: 1},
        },
      },
    }),
    id: 1,
  };

  Object.keys(overrides).forEach(k => args[k] = overrides[k]);

  return args;
};

const tests = [
  {
    args: makeArgs({ctx: undefined}),
    description: 'A Telegram context is expected',
    error: [400, 'ExpectedTelegramContextToHandleEditedMessage'],
  },
  {
    args: makeArgs({id: undefined}),
    description: 'A connected user id is expected',
    error: [400, 'ExpectedConnectedUserIdToHandleEditedMessage'],
  },
  {
    args: makeArgs({}),
    description: 'A message edited just now gets a warning',
    expected: {
      replies: [{
        options: {
          parse_mode: 'MarkdownV2',
          reply_markup: new InlineKeyboard().text('OK', 'remove-message'),
        },
        text: '⚠️ *Editing past messages is not supported\\.*',
      }],
    },
  },
  {
    args: makeArgs({id: 2}),
    description: 'An edit that is not from the connected user is ignored',
    expected: {replies: []},
  },
  {
    args: makeArgs({
      ctx: makeCtx({update: {edited_message: {date: nowSeconds()}}}),
    }),
    description: 'An edit without a from user is ignored',
    expected: {replies: []},
  },
  {
    args: makeArgs({
      ctx: makeCtx({
        update: {edited_message: {date: nowSeconds() - 60, from: {id: 1}}},
      }),
    }),
    description: 'An edit made a minute ago is ignored',
    expected: {replies: []},
  },
  {
    args: makeArgs({ctx: makeCtx({update: {}})}),
    description: 'An update without an edited message is ignored',
    expected: {replies: []},
  },
  {
    args: makeArgs({ctx: makeCtx({})}),
    description: 'A context without an update is ignored',
    expected: {replies: []},
  },
];

tests.forEach(({args, description, error, expected}) => {
  return test(description, async () => {
    if (!!error) {
      await rejects(handleEditedMessage(args), error, 'Got expected error');
    } else {
      await handleEditedMessage(args);

      deepEqual(args.ctx.replies, expected.replies, 'Got expected replies');
    }

    return;
  });
});
