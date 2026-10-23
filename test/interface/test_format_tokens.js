const {deepEqual} = require('node:assert').strict;
const test = require('node:test');

const {formatTokens} = require('./../../interface');

const tests = [
  {
    args: {none: '-', tokens: 0},
    description: 'The none value is shown when there are no tokens',
    expected: {display: '-'},
  },
  {
    args: {none: '-', tokens: 1},
    description: 'Tokens are shown when there is a none value and tokens',
    expected: {display: '0.00000001'},
  },
  {
    args: {tokens: 0},
    description: 'Zero tokens are shown when there is no none value',
    expected: {display: '0.00000000'},
  },
  {
    args: {tokens: 123456789},
    description: 'Tokens are shown in big units by default',
    expected: {display: '1.23456789'},
  },
  {
    args: {tokens: 123},
    description: 'Full tokens are shown when full tokens are preferred',
    expected: {display: '123'},
    preferred: 'full',
  },
  {
    args: {tokens: 123.5},
    description: 'Rounded tokens are shown when rounded tokens are preferred',
    expected: {display: '124'},
    preferred: 'rounded',
  },
  {
    args: {none: '-', tokens: 0},
    description: 'The none value is shown regardless of the preference',
    expected: {display: '-'},
    preferred: 'full',
  },
  {
    args: {tokens: 1},
    description: 'Tokens are shown in big units for an unknown preference',
    expected: {display: '0.00000001'},
    preferred: 'unknown',
  },
];

tests.forEach(({args, description, expected, preferred}) => {
  return test(description, (context, end) => {
    // The preferred display type is read from the environment
    process.env.PREFERRED_TOKENS_TYPE = preferred || String();

    const res = formatTokens(args);

    delete process.env.PREFERRED_TOKENS_TYPE;

    deepEqual(res, expected, 'Got expected result');

    return end();
  });
});
