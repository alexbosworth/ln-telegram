const {deepEqual} = require('node:assert').strict;
const test = require('node:test');

const {handleConnectCommand} = require('./../../');

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
    description: 'A bot that is not connected replies with the connect code',
    expected: {replies: ['🤖 Connection code is: `1`']},
  },
];

tests.forEach(({args, description, expected}) => {
  return test(description, (context, end) => {
    handleConnectCommand(args);

    deepEqual(args.calls, expected, 'Got expected result');

    return end();
  });
});
