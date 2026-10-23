const {deepEqual} = require('node:assert').strict;
const {rejects} = require('node:assert').strict;
const test = require('node:test');

const {handleMempoolCommand} = require('./../../');

const defaultResponse = [null, {statusCode: 200}, [
  {blockVSize: 1e6, medianFee: 10.2},
  {blockVSize: 5e5, medianFee: 5},
  {blockVSize: 9e6, medianFee: 1},
]];
const defaultUrl = 'https://mempool.space/api/v1/fees/mempool-blocks';
const mempoolBlocksUrl = 'https://example.com/api/v1/fees/mempool-blocks';

const makeArgs = (overrides, response) => {
  const calls = {replies: [], requests: []};

  const args = {
    calls,
    from: 1,
    id: 1,
    reply: text => calls.replies.push(text.split('\n')),
    request: (options, cbk) => {
      calls.requests.push(options);

      return cbk(...(response || defaultResponse));
    },
  };

  Object.keys(overrides).forEach(k => args[k] = overrides[k]);

  return args;
};

const tests = [
  {
    args: makeArgs({from: undefined}),
    description: 'The id of the user sending the command is expected',
    error: [400, 'ExpectedFromUserIdNumberForMempoolCommand'],
  },
  {
    args: makeArgs({reply: undefined}),
    description: 'A reply function is expected',
    error: [400, 'ExpectedReplyFunctionToHandleMempoolCommand'],
  },
  {
    args: makeArgs({request: undefined}),
    description: 'A request function is expected',
    error: [400, 'ExpectedRequestFunctionToHandleMempoolCommand'],
  },
  {
    args: makeArgs({from: 2}),
    description: 'Only the connected user can get a mempool report',
    error: [401, 'CommandRequiresConnectCode'],
  },
  {
    args: makeArgs({}),
    description: 'A mempool report is posted',
    expected: {
      replies: [
        ['🤖 Generating mempool report...'],
        [
          '⏹ **mempool.space reports:**',
          '',
          '``` Wait    Fee Rate   Filled ',
          ' 10 min  ~11/vByte  ██████ ',
          ' 20 min  ~5/vByte   ███    ',
          '',
          '```',
        ],
      ],
      requests: [{json: true, url: defaultUrl}],
    },
  },
  {
    args: makeArgs({}, [
      null,
      {statusCode: 200},
      [...Array(7)].map(() => ({blockVSize: 1e6, medianFee: 1})),
    ]),
    description: 'A mempool report shows up to six blocks',
    expected: {
      replies: [
        ['🤖 Generating mempool report...'],
        [
          '⏹ **mempool.space reports:**',
          '',
          '``` Wait    Fee Rate  Filled ',
          ' 10 min  ~1/vByte  ██████ ',
          ' 20 min  ~1/vByte  ██████ ',
          ' 30 min  ~1/vByte  ██████ ',
          ' 40 min  ~1/vByte  ██████ ',
          ' 50 min  ~1/vByte  ██████ ',
          ' 60 min  ~1/vByte  ██████ ',
          '',
          '```',
        ],
      ],
      requests: [{json: true, url: defaultUrl}],
    },
  },
  {
    args: makeArgs(
      {url: mempoolBlocksUrl},
      [null, {statusCode: 200}, [{blockVSize: 1, medianFee: 1}]],
    ),
    description: 'Mempool command accepts a mempool blocks URL argument',
    expected: {
      replies: [
        ['🤖 Generating mempool report...'],
        [
          '⏹ **mempool.space reports:**',
          '',
          '``` Wait    Fee Rate  Filled ',
          ' 10 min  ~1/vByte  █      ',
          '',
          '```',
        ],
      ],
      requests: [{json: true, url: mempoolBlocksUrl}],
    },
  },
  {
    args: makeArgs({}, ['err']),
    description: 'A failure to get the mempool is posted',
    expected: {
      replies: [
        ['🤖 Generating mempool report...'],
        ['🤖 Getting mempool from mempool.space failed ☹️'],
      ],
      requests: [{json: true, url: defaultUrl}],
    },
  },
  {
    args: makeArgs({}, []),
    description: 'A missing mempool response is posted as a failure',
    expected: {
      replies: [
        ['🤖 Generating mempool report...'],
        ['🤖 Getting mempool from mempool.space failed ☹️'],
      ],
      requests: [{json: true, url: defaultUrl}],
    },
  },
  {
    args: makeArgs({}, [null, {statusCode: 500}, []]),
    description: 'An unexpected mempool status code is posted as a failure',
    expected: {
      replies: [
        ['🤖 Generating mempool report...'],
        ['🤖 Getting mempool from mempool.space failed ☹️'],
      ],
      requests: [{json: true, url: defaultUrl}],
    },
  },
  {
    args: makeArgs({}, [null, {statusCode: 200}, {}]),
    description: 'An unexpected mempool response is posted as a failure',
    expected: {
      replies: [
        ['🤖 Generating mempool report...'],
        ['🤖 Getting mempool from mempool.space failed ☹️'],
      ],
      requests: [{json: true, url: defaultUrl}],
    },
  },
];

tests.forEach(({args, description, error, expected}) => {
  return test(description, async () => {
    if (!!error) {
      await rejects(handleMempoolCommand(args), error, 'Got expected error');
    } else {
      await handleMempoolCommand(args);

      deepEqual(args.calls, expected, 'Got expected result');
    }

    return;
  });
});
