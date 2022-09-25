const {test} = require('@alexbosworth/tap');

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
    args: makeArgs({id: undefined}),
    description: 'Checking access requires an allowed user id',
    error: [401, 'CommandRequiresConnectCode'],
  },
  {
    args: makeArgs({from: 2}),
    description: 'Checking access requires identical from and id values',
    error: [401, 'CommandRequiresConnectCode'],
  },
  {
    args: makeArgs({}),
    description: 'Checking access resolves as checked',
  },
];

tests.forEach(({args, description, error, expected}) => {
  return test(description, async ({end, equal, rejects}) => {
    if (!!error) {
      await rejects(checkAccess(args), error, 'Got expected error');
    } else {
      await checkAccess(args);
    }

    return end();
  });
});
