const {deepEqual} = require('node:assert').strict;
const {rejects} = require('node:assert').strict;
const test = require('node:test');

const terminateBot = require('./../../buttons/terminate_bot');

const makeBot = ({}) => {
  const calls = {stopped: 0};

  return {calls, stop: async () => calls.stopped++};
};

const makeCtx = ({}) => {
  const calls = {answered: 0, deleted: 0, replies: []};

  return {
    calls,
    answerCallbackQuery: async () => calls.answered++,
    deleteMessage: async () => calls.deleted++,
    reply: async (text, options) => {
      return calls.replies.push({options, text: text.split('\n')});
    },
  };
};

const makeArgs = overrides => {
  const calls = {exits: 0};

  const args = {
    calls,
    bot: makeBot({}),
    ctx: makeCtx({}),
    exit: () => calls.exits++,
  };

  Object.keys(overrides).forEach(k => args[k] = overrides[k]);

  return args;
};

const tests = [
  {
    args: makeArgs({bot: undefined}),
    description: 'A Telegram bot is expected',
    error: [400, 'ExpectedBotObjectToTerminateBot'],
  },
  {
    args: makeArgs({ctx: undefined}),
    description: 'A Telegram context is expected',
    error: [400, 'ExpectedTelegramContextToTerminateBot'],
  },
  {
    args: makeArgs({}),
    description: 'The bot is stopped and the process exits',
    expected: {
      bot: {stopped: 1},
      ctx: {
        answered: 1,
        deleted: 1,
        replies: [{
          options: {parse_mode: 'MarkdownV2'},
          text: ['🤖 Bot shutting down\\.\\.\\.'],
        }],
      },
      exits: 1,
    },
  },
];

tests.forEach(({args, description, error, expected}) => {
  return test(description, async () => {
    if (!!error) {
      await rejects(terminateBot(args), error, 'Got expected error');
    } else {
      await terminateBot(args);

      const res = {...args.calls, bot: args.bot.calls, ctx: args.ctx.calls};

      deepEqual(res, expected, 'Got expected result');
    }

    return;
  });
});
