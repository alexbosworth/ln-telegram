const {deepEqual} = require('node:assert').strict;
const {rejects} = require('node:assert').strict;
const test = require('node:test');

const {getInfoResponse} = require('./../fixtures');
const {handleInfoCommand} = require('./../../');

const key1 = Buffer.alloc(33, 2).toString('hex');
const key2 = Buffer.alloc(33, 3).toString('hex');

const makeLnd = overrides => {
  return {
    default: {
      getInfo: ({}, cbk) => {
        const res = JSON.parse(JSON.stringify(getInfoResponse));

        Object.keys(overrides).forEach(k => res[k] = overrides[k]);

        return cbk(null, res);
      },
    },
  };
};

const makeArgs = overrides => {
  const calls = {removed: 0, replies: []};

  const args = {
    calls,
    from: 1,
    id: 1,
    nodes: [{
      from: 'node1',
      lnd: makeLnd({
        alias: 'alias_1',
        identity_pubkey: key1,
        num_active_channels: 1,
        num_peers: 1,
        version: '0.19.0-beta',
      }),
      public_key: key1,
    }],
    remove: async () => calls.removed++,
    reply: async (text, options) => {
      return calls.replies.push({options, text: text.split('\n')});
    },
  };

  Object.keys(overrides).forEach(k => args[k] = overrides[k]);

  return args;
};

const tests = [
  {
    args: makeArgs({from: undefined}),
    description: 'The id of the user sending the command is expected',
    error: [400, 'ExpectedFromUserIdNumberForInfoCommand'],
  },
  {
    args: makeArgs({nodes: undefined}),
    description: 'An array of nodes is expected',
    error: [400, 'ExpectedArrayOfNodesForInfoCommand'],
  },
  {
    args: makeArgs({remove: undefined}),
    description: 'A remove function is expected',
    error: [400, 'ExpectedRemoveFunctionForInfoCommand'],
  },
  {
    args: makeArgs({reply: undefined}),
    description: 'A reply function is expected',
    error: [400, 'ExpectedReplyFunctionForInfoCommand'],
  },
  {
    args: makeArgs({from: 2}),
    description: 'Only the connected user can get node info',
    error: [401, 'CommandRequiresConnectCode'],
  },
  {
    args: makeArgs({
      nodes: [{
        from: 'node1',
        lnd: {default: {getInfo: ({}, cbk) => cbk('err')}},
        public_key: key1,
      }],
    }),
    description: 'An error getting node info is passed back',
    error: [503, 'GetWalletInfoErr', {err: 'err'}],
  },
  {
    args: makeArgs({}),
    description: 'Node info is posted',
    expected: {
      removed: 1,
      replies: [{
        options: {parse_mode: 'MarkdownV2'},
        text: [
          'ℹ️ Info: alias\\_1 running 0\\.19\\.0\\-beta',
          `\`${key1}\``,
          '1 active channel and 1 peer\\.',
          '',
        ],
      }],
    },
  },
  {
    args: makeArgs({
      nodes: [
        {
          from: 'node1',
          lnd: makeLnd({
            alias: 'alias1',
            identity_pubkey: key1,
            num_active_channels: 0,
            num_peers: 0,
            version: '0.19.0-beta',
          }),
          public_key: key1,
        },
        {
          from: 'node2',
          lnd: makeLnd({
            alias: 'alias2',
            identity_pubkey: key2,
            num_active_channels: 2,
            num_peers: 3,
            version: '0.20.0-beta',
          }),
          public_key: key2,
        },
      ],
    }),
    description: 'Node info is posted for every node',
    expected: {
      removed: 1,
      replies: [{
        options: {parse_mode: 'MarkdownV2'},
        text: [
          'ℹ️ Info: alias1 running 0\\.19\\.0\\-beta',
          `\`${key1}\``,
          '0 active channels and 0 peers\\.',
          '',
          'ℹ️ Info: alias2 running 0\\.20\\.0\\-beta',
          `\`${key2}\``,
          '2 active channels and 3 peers\\.',
          '',
        ],
      }],
    },
  },
];

tests.forEach(({args, description, error, expected}) => {
  return test(description, async () => {
    if (!!error) {
      await rejects(handleInfoCommand(args), error, 'Got expected error');
    } else {
      await handleInfoCommand(args);

      deepEqual(args.calls, expected, 'Got expected result');
    }

    return;
  });
});
