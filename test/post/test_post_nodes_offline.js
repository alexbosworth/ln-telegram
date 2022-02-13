const {test} = require('@alexbosworth/tap');

const {postNodesOffline} = require('./../../');

const makeArgs = overrides => {
  const args = {
    bot: {api: {sendMessage: () => new Promise(resolve => resolve())}},
    connected: 1,
    offline: [{
      alias: 'alias',
      id: Buffer.alloc(33).toString('hex'),
    }],
  };

  Object.keys(overrides).forEach(k => args[k] = overrides[k]);

  return args;
};

const tests = [
  {
    args: makeArgs({bot: undefined}),
    description: 'Posting nodes offline requires bot to post with',
    error: [400, 'ExpectedTelegramBotToPostNodesOffline'],
  },
  {
    args: makeArgs({offline: undefined}),
    description: 'Post nodes offline requires offline nodes array',
    error: [400, 'ExpectedArrayOfOfflineNodesToPostNodesOffline'],
  },
  {
    args: makeArgs({}),
    description: 'Nodes online are posted',
    expected: '_😵 Lost connection\\! Cannot connect to alias 00000000\\._',
  },
  {
    args: makeArgs({connected: undefined}),
    description: 'A connected node is required to post a message',
  },
  {
    args: makeArgs({offline: []}),
    description: 'Offline nodes are required to post a message',
  },
];

tests.forEach(({args, description, error, expected}) => {
  return test(description, async ({end, equal, rejects}) => {
    if (!!error) {
      await rejects(postNodesOffline(args), error, 'Got expected error');
    } else {
      const res = await postNodesOffline(args);

      equal(res, expected, 'Got expected result');
    }

    return end();
  });
});
