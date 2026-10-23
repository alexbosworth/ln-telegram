const {deepEqual} = require('node:assert').strict;
const {rejects} = require('node:assert').strict;
const test = require('node:test');

const removeMessage = require('./../../buttons/remove_message');

const makeCtx = ({}) => {
  const calls = {answered: 0, deleted: 0};

  return {
    calls,
    answerCallbackQuery: async () => calls.answered++,
    deleteMessage: async () => calls.deleted++,
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
    error: [400, 'ExpectedTelegramContextToHandleRemoveMessage'],
  },
  {
    args: makeArgs({}),
    description: 'The message is removed',
    expected: {answered: 1, deleted: 1},
  },
];

tests.forEach(({args, description, error, expected}) => {
  return test(description, async () => {
    if (!!error) {
      await rejects(removeMessage(args), error, 'Got expected error');
    } else {
      await removeMessage(args);

      deepEqual(args.ctx.calls, expected, 'Got expected Telegram calls');
    }

    return;
  });
});
