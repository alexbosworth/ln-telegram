const {equal} = require('node:assert').strict;
const {rejects} = require('node:assert').strict;
const test = require('node:test');

const {postNodesOnline} = require('./../../');

const makeArgs = overrides => {
  const args = {
    id: 1,
    nodes: [{
      alias: 'alias-alias',
      id: Buffer.alloc(33).toString('hex'),
    }],
    send: () => new Promise((resolve, reject) => resolve()),
  };

  Object.keys(overrides).forEach(k => args[k] = overrides[k]);

  return args;
};

const tests = [
  {
    args: makeArgs({id: undefined}),
    description: 'Posting nodes online requires an id to send to',
    error: [400, 'ExpectedConnectedUserIdToPostOnlineNotification'],
  },
  {
    args: makeArgs({nodes: undefined}),
    description: 'Posting nodes online requires nodes',
    error: [400, 'ExpectedNodesToPostOnlineNotification'],
  },
  {
    args: makeArgs({send: undefined}),
    description: 'Post nodes online requires a send function',
    error: [400, 'ExpectedSendFunctionToPostOnlineNotification'],
  },
  {
    args: makeArgs({}),
    description: 'Nodes online are posted',
    expected: '_🤖 Connected to alias\\-alias_',
  },
  {
    args: makeArgs({nodes: [
      {
        id: Buffer.alloc(33, 2).toString('hex'),
      },
      {
        id: Buffer.alloc(33, 3).toString('hex'),
      },
    ]}),
    description: 'Multiple no alias nodes online are posted',
    expected: '_🤖 Connected to 020202020202020202020202020202020202020202020202020202020202020202, 030303030303030303030303030303030303030303030303030303030303030303_',
  },
];

tests.forEach(({args, description, error, expected}) => {
  return test(description, async () => {
    if (!!error) {
      await rejects(postNodesOnline(args), error, 'Got expected error');
    } else {
      const res = await postNodesOnline(args);

      equal(res, expected, 'Got expected result');
    }

    return;
  });
});
