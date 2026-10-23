const {deepEqual} = require('node:assert').strict;
const {rejects} = require('node:assert').strict;
const test = require('node:test');

const {getInfoResponse} = require('./../fixtures');
const {listChannelsResponse} = require('./../fixtures');
const {handleLiquidityCommand} = require('./../../');

const key = Buffer.alloc(33, 2).toString('hex');
const listChannelsRes = () => JSON.parse(JSON.stringify(listChannelsResponse));
const otherKey = Buffer.alloc(33, 5).toString('hex');
const otherPeer = Buffer.alloc(33, 4).toString('hex');
const peer = Buffer.alloc(33, 3).toString('hex');

const makePolicy = ({rate}) => {
  return {
    disabled: false,
    fee_base_msat: '1000',
    fee_rate_milli_msat: rate,
    last_update: 1,
    max_htlc_msat: '1000000',
    min_htlc: '1000',
    time_lock_delta: 40,
  };
};

const makeLnd = ({alias, methods, partner}) => {
  const lnd = {
    default: {
      getChanInfo: ({chan_id}, cbk) => cbk(null, {
        capacity: '3000',
        chan_point: `${Buffer.alloc(32).toString('hex')}:0`,
        channel_id: chan_id,
        node1_policy: makePolicy({rate: '100'}),
        node1_pub: key,
        node2_policy: makePolicy({rate: '200'}),
        node2_pub: partner || peer,
      }),
      getInfo: ({}, cbk) => cbk(null, getInfoResponse),
      getNodeInfo: ({pub_key}, cbk) => cbk(null, {
        channels: [],
        node: {
          pub_key,
          addresses: [],
          alias: alias || '',
          color: '#000000',
          features: {},
          last_update: 1,
        },
        num_channels: 1,
        total_capacity: '3000',
      }),
      listChannels: ({}, cbk) => {
        const [channel] = listChannelsRes().channels;

        channel.local_balance = '1000';
        channel.remote_balance = '2000';
        channel.remote_pubkey = partner || peer;

        return cbk(null, {channels: [channel]});
      },
    },
  };

  Object.keys(methods || {}).forEach(k => lnd.default[k] = methods[k]);

  return lnd;
};

const makeArgs = overrides => {
  const calls = {replies: [], working: 0};

  const args = {
    calls,
    from: 1,
    id: 1,
    nodes: [{from: 'node1', lnd: makeLnd({alias: 'alice'}), public_key: key}],
    reply: async (text, options) => {
      return calls.replies.push({options, text: text.split('\n')});
    },
    text: `/liquidity ${peer}`,
    working: () => calls.working++,
  };

  Object.keys(overrides).forEach(k => args[k] = overrides[k]);

  return args;
};

const tests = [
  {
    args: makeArgs({from: undefined}),
    description: 'A from user id is expected',
    error: [400, 'ExpectedFromUserIdNumberForLiquidityCommand'],
    expected: {replies: [], working: 0},
  },
  {
    args: makeArgs({id: undefined}),
    description: 'A connected user id is expected',
    error: [400, 'ExpectedConnectedIdNumberForLiquidityCommand'],
    expected: {replies: [], working: 0},
  },
  {
    args: makeArgs({nodes: undefined}),
    description: 'An array of nodes is expected',
    error: [400, 'ExpectedNodesForLiquidityCommand'],
    expected: {replies: [], working: 0},
  },
  {
    args: makeArgs({reply: undefined}),
    description: 'A reply function is expected',
    error: [400, 'ExpectedReplyFunctionForLiquidityCommand'],
    expected: {replies: [], working: 0},
  },
  {
    args: makeArgs({text: undefined}),
    description: 'The command text is expected',
    error: [400, 'ExpectedOriginalCommandTextForLiquidityCommand'],
    expected: {replies: [], working: 0},
  },
  {
    args: makeArgs({working: undefined}),
    description: 'A working function is expected',
    error: [400, 'ExpectedWorkingFunctionForLiquidityCommand'],
    expected: {replies: [], working: 0},
  },
  {
    args: makeArgs({from: 2}),
    description: 'The command is only allowed for the connected user',
    error: [401, 'CommandRequiresConnectCode'],
    expected: {replies: [], working: 0},
  },
  {
    args: makeArgs({text: '/liquidity'}),
    description: 'Liquidity is posted',
    expected: {
      replies: [{
        options: {parse_mode: 'MarkdownV2'},
        text: [
          '🌊 *Liquidity:*',
          '',
          '```',
          ' Inbound   0.00002000   ',
          ' Outbound  0.00001000   ',
          '',
          '```',
        ],
      }],
      working: 2,
    },
  },
  {
    args: makeArgs({}),
    description: 'Liquidity with a peer is posted',
    expected: {
      replies: [{
        options: {parse_mode: 'MarkdownV2'},
        text: [
          '🌊 *Liquidity with alice 03030303:*',
          '',
          '```',
          ' Inbound   0.00002000  0.02% (200) ',
          ' Outbound  0.00001000  0.01% (100) ',
          '',
          '```',
        ],
      }],
      working: 3,
    },
  },
  {
    args: makeArgs({text: '/liquidity ali'}),
    description: 'Liquidity with a peer found by alias is posted',
    expected: {
      replies: [{
        options: {parse_mode: 'MarkdownV2'},
        text: [
          '🌊 *Liquidity with alice 03030303:*',
          '',
          '```',
          ' Inbound   0.00002000  0.02% (200) ',
          ' Outbound  0.00001000  0.01% (100) ',
          '',
          '```',
        ],
      }],
      working: 3,
    },
  },
  {
    args: makeArgs({text: '/liquidity bob'}),
    description: 'A peer that cannot be found is reported',
    error: [404, 'FailedToFindPeerMatch'],
    expected: {
      replies: [{options: undefined, text: ['🤖 Peer not found']}],
      working: 1,
    },
  },
  {
    args: makeArgs({
      nodes: [
        {from: 'node1', lnd: makeLnd({alias: 'alice'}), public_key: key},
        {
          from: 'node2',
          lnd: makeLnd({alias: 'alice', partner: otherPeer}),
          public_key: otherKey,
        },
      ],
      text: '/liquidity alice',
    }),
    description: 'A query that matches different peers is reported',
    error: [404, 'FailedToFindPeerMatch'],
    expected: {
      replies: [{options: undefined, text: ['🤖 Peer not found']}],
      working: 1,
    },
  },
  {
    args: makeArgs({
      nodes: [{
        from: 'node1',
        lnd: makeLnd({methods: {listChannels: ({}, cbk) => cbk('err')}}),
        public_key: key,
      }],
    }),
    description: 'An error getting channels is passed back',
    error: [503, 'UnexpectedGetChannelsError', {err: 'err'}],
    expected: {replies: [], working: 1},
  },
  {
    args: makeArgs({
      nodes: [{
        from: 'node1',
        lnd: makeLnd({methods: {getChanInfo: ({}, cbk) => cbk('err')}}),
        public_key: key,
      }],
    }),
    description: 'An error getting channel details is passed back',
    error: [503, 'UnexpectedGetChannelInfoError', {err: 'err'}],
    expected: {replies: [], working: 1},
  },
  {
    args: makeArgs({
      nodes: [{
        from: 'node1',
        lnd: makeLnd({
          methods: {
            // Both inbound and outbound liquidity are requested before failure
            listChannels: ({}, cbk) => process.nextTick(() => cbk('err')),
          },
        }),
        public_key: key,
      }],
      text: '/liquidity',
    }),
    description: 'An error getting liquidity is passed back',
    error: [503, 'UnexpectedGetChannelsError', {err: 'err'}],
    expected: {replies: [], working: 2},
  },
];

tests.forEach(({args, description, error, expected}) => {
  return test(description, async () => {
    if (!!error) {
      await rejects(handleLiquidityCommand(args), error, 'Got expected error');
    } else {
      await handleLiquidityCommand(args);
    }

    deepEqual(args.calls, expected, 'Got expected calls');

    return;
  });
});
