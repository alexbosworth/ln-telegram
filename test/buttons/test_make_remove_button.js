const {deepEqual} = require('node:assert').strict;
const {InlineKeyboard} = require('grammy');
const test = require('node:test');

const makeRemoveButton = require('./../../buttons/make_remove_button');

const tests = [
  {
    args: {},
    description: 'A remove message button is made',
    expected: {markup: new InlineKeyboard().text('OK', 'remove-message')},
  },
];

tests.forEach(({args, description, expected}) => {
  return test(description, (context, end) => {
    deepEqual(makeRemoveButton(args), expected, 'Got expected result');

    return end();
  });
});
