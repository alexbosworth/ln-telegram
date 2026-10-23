const {deepEqual} = require('node:assert').strict;
const test = require('node:test');

const {handleStartCommand} = require('./../../');

const makeArgs = overrides => {
  const calls = {replies: []};

  const args = {
    calls,
    from: 1,
    id: 1,
    reply: text => calls.replies.push(text),
  };

  Object.keys(overrides).forEach(k => args[k] = overrides[k]);

  return args;
};

const tests = [
  {
    args: makeArgs({}),
    description: 'A connected bot replies that it is online',
    expected: {replies: ['🤖 *Bot is online.* /help for commands']},
  },
  {
    args: makeArgs({id: undefined}),
    description: 'A bot that is not connected replies with how to connect',
    expected: {replies: ['🤖 *Bot started, run /connect to authorize.*']},
  },
];

tests.forEach(({args, description, expected}) => {
  return test(description, (context, end) => {
    handleStartCommand(args);

    deepEqual(args.calls, expected, 'Got expected result');

    return end();
  });
});
