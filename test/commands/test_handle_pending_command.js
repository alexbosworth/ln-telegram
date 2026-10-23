const {deepEqual} = require('node:assert').strict;
const EventEmitter = require('node:events');
const {rejects} = require('node:assert').strict;
const test = require('node:test');

const {getInfoResponse} = require('./../fixtures');
const {listChannelsResponse} = require('./../fixtures');
const {nodeInfoResult} = require('./../fixtures');
const {pendingChannelsResponse} = require('./../fixtures');
const {handlePendingCommand} = require('./../../');

const inChannel = '1099511693313';
const inPeer = Buffer.alloc(33, 2).toString('hex');
const key = Buffer.alloc(33, 4).toString('hex');
const listChannelsRes = () => JSON.parse(JSON.stringify(listChannelsResponse));
const otherKey = Buffer.alloc(33, 5).toString('hex');
const outChannel = '2199023386626';
const outPeer = Buffer.alloc(33, 3).toString('hex');
const pendingRes = () => JSON.parse(JSON.stringify(pendingChannelsResponse));

const makeChannel = overrides => {
  const [channel] = listChannelsRes().channels;

  Object.keys(overrides).forEach(k => channel[k] = overrides[k]);

  return channel;
};

const makeHtlc = overrides => {
  const htlc = {
    amount: '1',
    expiration_height: 1,
    forwarding_channel: '0',
    forwarding_htlc_index: '1',
    hash_lock: Buffer.alloc(32),
    htlc_index: '1',
    incoming: false,
  };

  Object.keys(overrides).forEach(k => htlc[k] = overrides[k]);

  return htlc;
};

const makePending = ({key}) => {
  const pending = pendingRes();

  pending.pending_force_closing_channels.push({
    channel: {
      capacity: '1',
      channel_point: `${Buffer.alloc(32).toString('hex')}:1`,
      local_balance: '1',
      local_chan_reserve_sat: '1',
      remote_balance: '1',
      remote_chan_reserve_sat: '1',
      remote_node_pub: key,
    },
    closing_txid: Buffer.alloc(32, 1).toString('hex'),
    limbo_balance: '1',
    maturity_height: 8,
    pending_htlcs: [],
    recovered_balance: '1',
  });

  return pending;
};

const makeLnd = ({methods}) => {
  const lnd = {
    chain: {
      // Without the chain notifier, the block height comes from wallet info
      registerBlockEpochNtfn: ({}) => {
        const emitter = new EventEmitter();

        emitter.cancel = () => {};

        process.nextTick(() => emitter.emit('error', 'err'));

        return emitter;
      },
    },
    default: {
      getInfo: ({}, cbk) => cbk(null, getInfoResponse),
      getNodeInfo: ({}, cbk) => cbk(null, nodeInfoResult),
      listChannels: ({}, cbk) => cbk(null, {
        channels: [
          makeChannel({
            chan_id: inChannel,
            pending_htlcs: [
              makeHtlc({
                amount: '2',
                forwarding_channel: outChannel,
                incoming: true,
              }),
            ],
            remote_pubkey: inPeer,
          }),
          makeChannel({
            chan_id: outChannel,
            pending_htlcs: [
              makeHtlc({forwarding_channel: inChannel}),
              makeHtlc({hash_lock: Buffer.alloc(32, 1), htlc_index: '2'}),
            ],
            remote_pubkey: outPeer,
          }),
        ],
      }),
      pendingChannels: ({}, cbk) => cbk(null, makePending({key: outPeer})),
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
    nodes: [{from: 'node1', lnd: makeLnd({}), public_key: key}],
    reply: async (text, options) => {
      return calls.replies.push({options, text: text.split('\n')});
    },
    working: () => calls.working++,
  };

  Object.keys(overrides).forEach(k => args[k] = overrides[k]);

  return args;
};

const tests = [
  {
    args: makeArgs({from: undefined}),
    description: 'A from user id is expected',
    error: [400, 'ExpectedFromUserIdNumberForPendingCommand'],
  },
  {
    args: makeArgs({nodes: undefined}),
    description: 'An array of nodes is expected',
    error: [400, 'ExpectedNodesToHandlePendingCommand'],
  },
  {
    args: makeArgs({reply: undefined}),
    description: 'A reply function is expected',
    error: [400, 'ExpectedReplyFunctionToHandlePendingCommand'],
  },
  {
    args: makeArgs({working: undefined}),
    description: 'A working function is expected',
    error: [400, 'ExpectedWorkingFunctionToHandlePendingCommand'],
  },
  {
    args: makeArgs({from: 2}),
    description: 'The command is only allowed for the connected user',
    error: [401, 'CommandRequiresConnectCode'],
  },
  {
    args: makeArgs({}),
    description: 'Pending payments and channels are posted',
    expected: {
      replies: [{
        options: {parse_mode: 'MarkdownV2'},
        text: [
          '⏳ Waiting for outbound 0\\.00000003 channel with alias 00000000 to confirm: `00`',
          '⏳ Waiting to recover 0\\.00000001 in 1 hour from closing channel with alias 03030303',
          '💸 Forwarding 0\\.00000001 for 0\\.00000001 fee from alias 02020202 to alias 03030303',
          '👽 Probing out alias 03030303',
        ],
      }],
      working: 1,
    },
  },
  {
    args: makeArgs({
      nodes: [{
        from: 'node1',
        lnd: makeLnd({
          methods: {
            listChannels: ({}, cbk) => {
              return cbk(null, {channels: [makeChannel({})]});
            },
            pendingChannels: ({}, cbk) => cbk(null, {
              pending_force_closing_channels: [],
              pending_open_channels: [],
              waiting_close_channels: [],
            }),
          },
        }),
        public_key: key,
      }],
    }),
    description: 'Nothing pending is posted',
    expected: {
      replies: [{
        options: {parse_mode: 'MarkdownV2'},
        text: ['🤖 No pending payments or channels'],
      }],
      working: 1,
    },
  },
  {
    args: makeArgs({
      nodes: [
        {
          from: 'node1',
          lnd: makeLnd({
            methods: {
              pendingChannels: ({}, cbk) => cbk(null, {
                pending_force_closing_channels: [],
                pending_open_channels: [],
                waiting_close_channels: [],
              }),
            },
          }),
          public_key: key,
        },
        {
          from: 'node2',
          lnd: makeLnd({
            methods: {listChannels: ({}, cbk) => cbk(null, {channels: []})},
          }),
          public_key: otherKey,
        },
      ],
    }),
    description: 'Pending items are posted under the name of their node',
    expected: {
      replies: [{
        options: {parse_mode: 'MarkdownV2'},
        text: [
          '*node2*',
          '⏳ Waiting for outbound 0\\.00000003 channel with alias 00000000 to confirm: `00`',
          '⏳ Waiting to recover 0\\.00000001 in 1 hour from closing channel with alias 03030303',
          '',
          '*node1*',
          '💸 Forwarding 0\\.00000001 for 0\\.00000001 fee from alias 02020202 to alias 03030303',
          '👽 Probing out alias 03030303',
        ],
      }],
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
  },
  {
    args: makeArgs({
      nodes: [{
        from: 'node1',
        lnd: makeLnd({
          methods: {
            listChannels: ({}, cbk) => cbk(null, {
              channels: [
                makeChannel({
                  pending_htlcs: [makeHtlc({})],
                  remote_pubkey: 'remote_pubkey',
                }),
              ],
            }),
          },
        }),
        public_key: key,
      }],
    }),
    description: 'An error getting the alias of a payment peer is passed back',
    error: [400, 'ExpectedPublicKeyToGetNodeAliasFor'],
  },
  {
    args: makeArgs({
      nodes: [{
        from: 'node1',
        lnd: makeLnd({methods: {pendingChannels: ({}, cbk) => cbk('err')}}),
        public_key: key,
      }],
    }),
    description: 'An error getting pending channels is passed back',
    error: [503, 'UnexpectedPendingChannelsErr', {err: 'err'}],
  },
  {
    args: makeArgs({
      nodes: [{
        from: 'node1',
        lnd: makeLnd({
          methods: {
            pendingChannels: ({}, cbk) => {
              return cbk(null, makePending({key: 'remote_node_pub'}));
            },
          },
        }),
        public_key: key,
      }],
    }),
    description: 'An error getting the alias of a channel peer is passed back',
    error: [400, 'ExpectedPublicKeyToGetNodeAliasFor'],
  },
  {
    args: makeArgs({
      nodes: [{
        from: 'node1',
        lnd: makeLnd({methods: {getInfo: ({}, cbk) => cbk('err')}}),
        public_key: key,
      }],
    }),
    description: 'An error getting the block height is passed back',
    error: [503, 'GetWalletInfoErr', {err: 'err'}],
  },
];

tests.forEach(({args, description, error, expected}) => {
  return test(description, async () => {
    if (!!error) {
      await rejects(handlePendingCommand(args), error, 'Got expected error');
    } else {
      await handlePendingCommand(args);

      deepEqual(args.calls, expected, 'Got expected result');
    }

    return;
  });
});
