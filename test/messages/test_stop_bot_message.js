const {deepEqual} = require('node:assert').strict;
const {InlineKeyboard} = require('grammy');
const test = require('node:test');

const {stopBotMessage} = require('./../../messages');

const tests = [
  {
    args: {},
    description: 'A stop bot confirmation message is mapped',
    expected: {
      markup: new InlineKeyboard()
        .text('Confirm, Stop Bot', 'terminate-bot')
        .text('Cancel', 'remove-message'),
      mode: 'MarkdownV2',
      text: '🤖 Are you sure that you want to stop the bot?',
    },
  },
];

tests.forEach(({args, description, expected}) => {
  return test(description, (context, end) => {
    deepEqual(stopBotMessage(args), expected, 'Got expected result');

    return end();
  });
});
