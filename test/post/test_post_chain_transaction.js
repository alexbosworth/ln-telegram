const {test} = require('tap');

const {postChainTransaction} = require('./../../');

const makeArgs = overrides => {
  const args = {
    from: 'from',
    id: 1,
    key: 'key',
    request: ({}, cbk) => cbk(null, {statusCode: 200}, {}),
    transaction: {
      chain_fee: 1,
      related_channels: [
        {
          action: 'action',
          node: 'node',
          with: Buffer.alloc(33).toString('hex'),
        },
        {
          action: 'channel_closing',
        },
        {
          action: 'cooperatively_closed_channel',
        },
        {
          action: 'force_closed_channel',
        },
        {
          action: 'opened_channel',
        },
        {
          action: 'opening_channel',
        },
        {
          action: 'peer_force_closed_channel',
        },
        {
          action: 'peer_force_closing_channel',
        },
      ],
      sent: 1,
      sent_to: ['address'],
    },
  };

  Object.keys(overrides).forEach(k => args[k] = overrides[k]);

  return args;
};

const tests = [
  {
    args: makeArgs({from: undefined}),
    description: 'A from node string is expected',
    error: [400, 'ExpectedFromNodeFromToPostChainTransaction'],
  },
  {
    args: makeArgs({id: undefined}),
    description: 'An id is expected',
    error: [400, 'ExpectedConnectedUserIdToPostChainTransaction'],
  },
  {
    args: makeArgs({key: undefined}),
    description: 'An api key is expected',
    error: [400, 'ExpectedApiKeyToPostChainTransaction'],
  },
  {
    args: makeArgs({request: undefined}),
    description: 'A request function is expected',
    error: [400, 'ExpectedRequestToPostChainTransaction'],
  },
  {
    args: makeArgs({transaction: undefined}),
    description: 'A transaction is expected',
    error: [400, 'ExpectedTransactionRecordToPostChainTransaction'],
  },
  {
    args: makeArgs({transaction: {}}),
    description: 'Transaction related channels is expected',
    error: [400, 'ExpectedRelatedChannelsInTransactionToPost'],
  },
  {
    args: makeArgs({}),
    description: 'A chain transaction is posted',
  },
  {
    args: makeArgs({
      transaction: {
        received: 1,
        related_channels: [],
        send: undefined,
        sent_to: undefined,
      },
    }),
    description: 'A receive chain transaction is posted',
  },
  {
    args: makeArgs({
      transaction: {
        received: undefined,
        related_channels: [],
        send: undefined,
        sent_to: undefined,
      },
    }),
    description: 'A 3rd party chain transaction is posted',
  },
];

tests.forEach(({args, description, error, expected}) => {
  return test(description, async ({end, equal, rejects}) => {
    if (!!error) {
      await rejects(postChainTransaction(args), error, 'Got expected error');
    } else {
      await postChainTransaction(args);
    }

    return end();
  });
});
