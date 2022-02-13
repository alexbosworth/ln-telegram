const {test} = require('@alexbosworth/tap');

const {postChainTransaction} = require('./../../');

const makeTransaction = overrides => {
  const tx = {
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
  };

  Object.keys(overrides).forEach(k => tx[k] = overrides[k]);

  return tx;
};

const makeArgs = overrides => {
  const args = {
    from: 'from',
    id: 1,
    nodes: [{}],
    send: ({}) => new Promise(resolve => resolve()),
    transaction: makeTransaction({}),
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
    args: makeArgs({nodes: undefined}),
    description: 'An array of nodes is expected',
    error: [400, 'ExpectedArrayOfNodesToPostChainTransaction'],
  },
  {
    args: makeArgs({send: undefined}),
    description: 'A send function is expected',
    error: [400, 'ExpectedSendFunctionToPostChainTransaction'],
  },
  {
    args: makeArgs({transaction: undefined}),
    description: 'A transaction is expected',
    error: [400, 'ExpectedTransactionRecordToPostChainTransaction'],
  },
  {
    args: makeArgs({}),
    description: 'A regular chain transaction is posted',
    expected: '⛓ \\(pending\\) Sent 0\\.00000001\\. Paid 0\\.00000001 fee\\. Sent to address\\. Related: Closing channel with \\. Cooperatively closed with \\. Force closed channel with \\. Opened channel with \\. Opening channel with \\.  force closed channel\\.  force closing channel',
  },
  {
    args: makeArgs({nodes: [{}, {}]}),
    description: 'A regular chain transaction is posted from multiple nodes',
    expected: '⛓ \\(pending\\) Sent 0\\.00000001\\. Paid 0\\.00000001 fee\\. Sent to address\\. Related: Closing channel with \\. Cooperatively closed with \\. Force closed channel with \\. Opened channel with \\. Opening channel with \\.  force closed channel\\.  force closing channel \\- _from_',
  },
  {
    args: makeArgs({
      transaction: makeTransaction({related_channels: undefined}),
    }),
    description: 'Transaction related channels is expected',
    error: [400, 'ExpectedRelatedChannelsInTransactionToPost'],
  },
  {
    args: makeArgs({transaction: makeTransaction({received: 1})}),
    description: 'A receive chain transaction is posted',
    expected: '⛓ \\(pending\\) Received 0\\.00000001\\. Paid 0\\.00000001 fee\\. Related: Closing channel with \\. Cooperatively closed with \\. Force closed channel with \\. Opened channel with \\. Opening channel with \\.  force closed channel\\.  force closing channel',
  },
  {
    args: makeArgs({
      confirmed: true,
      transaction: makeTransaction({
        received: undefined,
        related_channels: [],
      }),
    }),
    description: 'A chain transaction is posted',
    expected: '⛓ Sent 0\\.00000001\\. Paid 0\\.00000001 fee\\. Sent to address',
  },
  {
    args: makeArgs({
      transaction: {
        received: 1,
        related_channels: [],
        sent: undefined,
        sent_to: undefined,
      },
    }),
    description: 'A receive chain transaction is posted',
    expected: '⛓ \\(pending\\) Received 0\\.00000001',
  },
  {
    args: makeArgs({
      transaction: {
        received: undefined,
        related_channels: [],
        sent: undefined,
        sent_to: undefined,
      },
    }),
    description: 'A 3rd party chain transaction is posted',
  },
  {
    args: makeArgs({transaction: makeTransaction({sent_to: undefined})}),
    description: 'A chain transaction is posted with no addresses',
    expected: '⛓ \\(pending\\) Sent 0\\.00000001\\. Paid 0\\.00000001 fee\\. Related: Closing channel with \\. Cooperatively closed with \\. Force closed channel with \\. Opened channel with \\. Opening channel with \\.  force closed channel\\.  force closing channel',
  },
  {
    args: makeArgs({
      transaction: makeTransaction({
        received: 1,
        related_channels: [],
        sent: undefined,
        sent_to: undefined,
      }),
    }),
    description: 'A chain transaction is posted with no related channels',
    expected: '⛓ \\(pending\\) Received 0\\.00000001\\. Paid 0\\.00000001 fee',
  },
];

tests.forEach(({args, description, error, expected}) => {
  return test(description, async ({end, equal, rejects}) => {
    if (!!error) {
      await rejects(postChainTransaction(args), error, 'Got expected error');
    } else {
      const message = await postChainTransaction(args);

      equal(message, expected, 'Got expected message');
    }

    return end();
  });
});
