const {deepEqual} = require('node:assert').strict;
const {InlineKeyboard} = require('grammy');
const {rejects} = require('node:assert').strict;
const test = require('node:test');

const warnUnknownButton = require('./../../buttons/warn_unknown_button');

const makeCtx = ({}) => {
  const calls = {answered: 0, replies: []};

  return {
    calls,
    answerCallbackQuery: async () => calls.answered++,
    reply: async (text, options) => {
      return calls.replies.push({options, text: text.split('\n')});
    },
  };
};

const makeArgs = overrides => {
  const args = {ctx: makeCtx({})};

  Object.keys(overrides).forEach(k => args[k] = overrides[k]);

  return args;
};

const tests = [
  {
    args: makeArgs({ctx: undefined}),
    description: 'A Telegram context is expected',
    error: [400, 'ExpectedTelegramContextToHandleUnknownButton'],
  },
  {
    args: makeArgs({}),
    description: 'A warning about the unknown button is posted',
    expected: {
      answered: 1,
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
  },
];

tests.forEach(({args, description, error, expected}) => {
  return test(description, async () => {
    if (!!error) {
      await rejects(warnUnknownButton(args), error, 'Got expected error');
    } else {
      await warnUnknownButton(args);

      deepEqual(args.ctx.calls, expected, 'Got expected Telegram calls');
    }

    return;
  });
});
