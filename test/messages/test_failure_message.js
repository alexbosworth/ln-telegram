const {deepEqual} = require('node:assert').strict;
const {InlineKeyboard} = require('grammy');
const test = require('node:test');

const {failureMessage} = require('./../../messages');

const tests = [
  {
    args: {},
    description: 'A generic failure message is mapped',
    expected: {message: '⚠️ _Unexpected error :(_'},
  },
  {
    args: {is_fractional_amount: true},
    description: 'A fractional amount failure message is mapped',
    expected: {
      message: '⚠️ _Amount not understood. Try a non-fractional number? _',
    },
  },
  {
    args: {is_invalid_amount: true},
    description: 'An invalid amount failure message is mapped',
    expected: {message: '⚠️ _Amount not understood. Try a number?_'},
  },
  {
    args: {is_paid_invoice: true},
    description: 'A paid invoice failure message is mapped',
    expected: {
      message: '⚠️ _Invoice already paid, so it cannot be changed._',
    },
  },
  {
    args: {is_fractional_amount: true, is_invalid_amount: true},
    description: 'A fractional amount failure takes precedence',
    expected: {
      message: '⚠️ _Amount not understood. Try a non-fractional number? _',
    },
  },
];

tests.forEach(({args, description, expected}) => {
  return test(description, (context, end) => {
    const actions = {
      parse_mode: 'Markdown',
      reply_markup: new InlineKeyboard().text('OK', 'remove-message'),
    };

    deepEqual(
      failureMessage(args), {actions, ...expected}, 'Got expected result'
    );

    return end();
  });
});
