const {deepEqual} = require('node:assert').strict;
const {InlineKeyboard} = require('grammy');
const {rejects} = require('node:assert').strict;
const test = require('node:test');

const {handleStopCommand} = require('./../../');

const makeArgs = overrides => {
  const calls = {replies: []};

  const args = {
    calls,
    from: 1,
    id: 1,
    reply: async (text, options) => calls.replies.push({options, text}),
  };

  Object.keys(overrides).forEach(k => args[k] = overrides[k]);

  return args;
};

const tests = [
  {
    args: makeArgs({from: undefined}),
    description: 'The id of the user sending the command is expected',
    error: [400, 'ExpectedFromUserIdToExecuteStopCommand'],
  },
  {
    args: makeArgs({reply: undefined}),
    description: 'A reply function is expected',
    error: [400, 'ExpectedReplyFunctionToExecuteStopCommand'],
  },
  {
    args: makeArgs({from: 2}),
    description: 'Only the connected user can stop the bot',
    error: [401, 'CommandRequiresConnectCode'],
  },
  {
    args: makeArgs({}),
    description: 'Stopping the bot asks for confirmation',
    expected: {
      replies: [{
        options: {
          parse_mode: 'MarkdownV2',
          reply_markup: new InlineKeyboard()
            .text('Confirm, Stop Bot', 'terminate-bot')
            .text('Cancel', 'remove-message'),
        },
        text: '🤖 Are you sure that you want to stop the bot?',
      }],
    },
  },
];

tests.forEach(({args, description, error, expected}) => {
  return test(description, async () => {
    if (!!error) {
      await rejects(handleStopCommand(args), error, 'Got expected error');
    } else {
      await handleStopCommand(args);

      deepEqual(args.calls, expected, 'Got expected result');
    }

    return;
  });
});
