const {rejects} = require('node:assert').strict;
const test = require('node:test');

const {postUpdatedBackup} = require('./../../post');

const makeArgs = overrides => {
  const args = {
    backup: '00',
    id: 1,
    node: {
      alias: 'alias',
      public_key: Buffer.alloc(33).toString('hex'),
    },
    send: (id, file) => new Promise((resolve, reject) => resolve()),
  };

  Object.keys(overrides).forEach(k => args[k] = overrides[k]);

  return args;
};

const tests = [
  {
    args: makeArgs({backup: undefined}),
    description: 'Posting an updated backup requires a backup',
    error: [400, 'ExpectedBackupFileToPostUpdatedBackup'],
  },
  {
    args: makeArgs({id: undefined}),
    description: 'Posting an updated backup requires a user id',
    error: [400, 'ExpectedIdToPostUpdatedBackup'],
  },
  {
    args: makeArgs({node: undefined}),
    description: 'Posting an updated backup requires node details',
    error: [400, 'ExpectedNodeToPostUpdatedBackup'],
  },
  {
    args: makeArgs({send: undefined}),
    description: 'Posting an updated backup requires a send function',
    error: [400, 'ExpectedSendFunctionToPostUpdatedBackup'],
  },
  {
    args: makeArgs({}),
    description: 'An updated backup is posted',
  },
];

tests.forEach(({args, description, error, expected}) => {
  return test(description, async () => {
    if (!!error) {
      await rejects(postUpdatedBackup(args), error, 'Got expected error');
    } else {
      await postUpdatedBackup(args);
    }

    return;
  });
});
