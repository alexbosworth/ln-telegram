const {rejects} = require('node:assert').strict;
const test = require('node:test');

const {checkAccess} = require('./../../authentication');

const makeArgs = overrides => {
  const args = {from: 1, id: 1};

  Object.keys(overrides).forEach(k => args[k] = overrides[k]);

  return args;
};

const tests = [
  {
    args: makeArgs({from: undefined}),
    description: 'Checking access requires a from user id',
    error: [400, 'ExpectedFromUserIdToCheckAccess'],
  },
  {
    args: makeArgs({from: 0}),
    description: 'An empty from user id is rejected',
    error: [400, 'ExpectedFromUserIdToCheckAccess'],
  },
  {
    args: makeArgs({id: undefined}),
    description: 'Checking access requires an allowed user id',
    error: [401, 'CommandRequiresConnectCode'],
  },
  {
    args: makeArgs({id: null}),
    description: 'A null connected user id is rejected',
    error: [401, 'CommandRequiresConnectCode'],
  },
  {
    args: makeArgs({id: 0}),
    description: 'An empty connected user id is rejected',
    error: [401, 'CommandRequiresConnectCode'],
  },
  {
    args: makeArgs({from: 2}),
    description: 'Checking access requires identical from and id values',
    error: [401, 'CommandRequiresConnectCode'],
  },
  {
    args: makeArgs({from: '1'}),
    description: 'The sender user id is not coerced into a number',
    error: [401, 'CommandRequiresConnectCode'],
  },
  {
    args: makeArgs({id: '1'}),
    description: 'The connected user id is not coerced into a number',
    error: [401, 'CommandRequiresConnectCode'],
  },
  {
    args: makeArgs({}),
    description: 'Checking access resolves as checked',
  },
  {
    args: makeArgs({from: 2 ** 40, id: 2 ** 40}),
    description: 'Matching user ids larger than 32 bits are allowed',
  },
];

tests.forEach(({args, description, error}) => {
  ['Promise', 'callback'].forEach(mode => {
    return test(`${description} via ${mode}`, async () => {
      const result = mode === 'Promise' ? checkAccess(args) :
        new Promise((resolve, reject) => {
          checkAccess(args, (err, res) => !!err ? reject(err) : resolve(res));
        });

      if (!!error) {
        await rejects(result, error, 'Got expected error');
      } else {
        await result;
      }

      return;
    });
  });
});
