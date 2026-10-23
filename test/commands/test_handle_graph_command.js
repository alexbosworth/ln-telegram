const {chanNumber} = require('bolt07');
const {deepEqual} = require('node:assert').strict;
const EventEmitter = require('node:events');
const {InlineKeyboard} = require('grammy');
const {rejects} = require('node:assert').strict;
const {Settings} = require('luxon');
const test = require('node:test');

const graph = require('./../fixtures/graph');
const {listChannelsResponse} = require('./../fixtures');
const {versionInfo} = require('./../fixtures');
const {handleGraphCommand} = require('./../../');
const {key: destination} = require('./../fixtures/encoded');
const {request} = require('./../fixtures/encoded');

const alice = Buffer.alloc(33, 2).toString('hex');
const bob = Buffer.alloc(33, 7).toString('hex');
const carol = Buffer.alloc(33, 3).toString('hex');
const far = Buffer.alloc(33, 4).toString('hex');
const key = Buffer.alloc(33, 5).toString('hex');
const listChannelsRes = () => JSON.parse(JSON.stringify(listChannelsResponse));
const mallory = Buffer.alloc(33, 6).toString('hex');
const sumOf = arr => arr.reduce((sum, n) => sum + n, Number());

// Peer ages are shown in the default locale and zone, so pin those
Settings.defaultLocale = 'en-US';
Settings.defaultZone = 'utc';

const makePolicy = ({rate}) => {
  // Exit early when there is no known policy
  if (!rate) {
    return null;
  }

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

const makeLnd = ({methods}) => {
  const lnd = {
    chain: {
      registerBlockEpochNtfn: ({}) => {
        const emitter = new EventEmitter();

        emitter.cancel = () => {};

        process.nextTick(() => emitter.emit('data', {
          hash: Buffer.alloc(32),
          height: 300,
        }));

        return emitter;
      },
    },
    default: {
      getNodeInfo: ({pub_key}, cbk) => {
        const node = graph.nodes.find(n => n.public_key === pub_key);

        // Exit early when the node is not in the graph
        if (!node) {
          return cbk({details: 'unable to find node'});
        }

        const channels = graph.channels.filter(({policies}) => {
          return !!policies.find(n => n.public_key === pub_key);
        });

        const capacity = sumOf(channels.map(n => Number(n.capacity)));

        return cbk(null, {
          channels: channels.map(channel => {
            const [node1, node2] = channel.policies;

            return {
              capacity: channel.capacity,
              chan_point: `${Buffer.alloc(32).toString('hex')}:0`,
              channel_id: chanNumber({channel: channel.id}).number,
              node1_policy: makePolicy(node1),
              node1_pub: node1.public_key,
              node2_policy: makePolicy(node2),
              node2_pub: node2.public_key,
            };
          }),
          node: {
            pub_key,
            addresses: node.sockets.map(addr => ({addr, network: 'tcp'})),
            alias: node.alias,
            color: '#000000',
            features: node.features,
            last_update: 1,
          },
          num_channels: channels.length,
          total_capacity: capacity.toString(),
        });
      },
      listChannels: ({}, cbk) => {
        const res = listChannelsRes();

        res.channels.forEach(channel => channel.remote_pubkey = alice);

        return cbk(null, res);
      },
    },
    version: {getVersion: ({}, cbk) => cbk(null, versionInfo)},
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
    remove: async () => {},
    reply: async (text, options) => {
      return calls.replies.push({options, text: text.split('\n')});
    },
    text: `/graph ${carol}`,
    working: async () => calls.working++,
  };

  Object.keys(overrides).forEach(k => args[k] = overrides[k]);

  return args;
};

const tests = [
  {
    args: makeArgs({from: undefined}),
    description: 'A from user id is expected',
    error: [400, 'ExpectedFromUserIdNumberForGraphCommand'],
  },
  {
    args: makeArgs({nodes: undefined}),
    description: 'An array of nodes is expected',
    error: [400, 'ExpectedNodesForGraphCommand'],
  },
  {
    args: makeArgs({reply: undefined}),
    description: 'A reply function is expected',
    error: [400, 'ExpectedReplyFunctionForGraphCommand'],
  },
  {
    args: makeArgs({text: undefined}),
    description: 'The command text is expected',
    error: [400, 'ExpectedOriginalCommandTextForGraphCommand'],
  },
  {
    args: makeArgs({working: undefined}),
    description: 'A working function is expected',
    error: [400, 'ExpectedWorkingFunctionForGraphCommand'],
  },
  {
    args: makeArgs({from: 2}),
    description: 'The command is only allowed for the connected user',
    error: [401, 'CommandRequiresConnectCode'],
  },
  {
    args: makeArgs({}),
    description: 'Details about a node are posted',
    expected: {
      replies: [{
        options: {parse_mode: 'MarkdownV2'},
        text: [
          `Node: *carol* \`${carol}\``,
          'A 0\\.03500000 capacity node with 2 peers that accepts large channels\\. Clearnet connections are accepted\\.',
          '`                                 In %   Capacity    Out % ',
          ' 031b84c5567b1264  16 hours ago         0\\.02000000  0\\.04% ',
          ' alice of the lig  1 day ago     0\\.02%  0\\.01500000  0\\.03% ',
          '',
          '`',
        ],
      }],
      working: 1,
    },
  },
  {
    args: makeArgs({text: '/graph alice'}),
    description: 'Details about a node found by peer alias are posted',
    expected: {
      replies: [{
        options: {parse_mode: 'MarkdownV2'},
        text: [
          `Node: *alice🦄 of the lightning network* \`${alice}\``,
          'A 0\\.01500000 capacity node with 1 peer\\. Only Tor connections are supported\\.',
          '`                   In %   Capacity    Out % ',
          ' carol  1 day ago  0\\.03%  0\\.01500000  0\\.02% ',
          '',
          '`',
        ],
      }],
      working: 1,
    },
  },
  {
    args: makeArgs({text: `/graph ${request}`}),
    description: 'Details about a payment request destination are posted',
    expected: {
      replies: [{
        options: {parse_mode: 'MarkdownV2'},
        text: [
          `Node: *031b84c5567b1264* \`${destination}\``,
          'A node with 2 peers\\. They do not publish any network address\\.',
          '`                                 In %   Capacity    Out % ',
          ' 0404040404040404  8 hours ago                      0\\.05% ',
          ' carol             16 hours ago  0\\.04%  0\\.02000000        ',
          '',
          '`',
        ],
      }],
      working: 1,
    },
  },
  {
    args: makeArgs({text: `/graph ${bob}`}),
    description: 'Details about a node without peers on IPv6 are posted',
    expected: {
      replies: [{
        options: {parse_mode: 'MarkdownV2'},
        text: [
          `Node: *bob* \`${bob}\``,
          'A node with 0 peers\\. Clearnet connections are accepted\\.',
          '`       In %  Capacity  Out % ',
          '',
          '`',
        ],
      }],
      working: 1,
    },
  },
  {
    args: makeArgs({
      remove: async () => {
        throw new Error('err');
      },
    }),
    description: 'A failure to remove the command message is ignored',
    expected: {
      replies: [{
        options: {parse_mode: 'MarkdownV2'},
        text: [
          `Node: *carol* \`${carol}\``,
          'A 0\\.03500000 capacity node with 2 peers that accepts large channels\\. Clearnet connections are accepted\\.',
          '`                                 In %   Capacity    Out % ',
          ' 031b84c5567b1264  16 hours ago         0\\.02000000  0\\.04% ',
          ' alice of the lig  1 day ago     0\\.02%  0\\.01500000  0\\.03% ',
          '',
          '`',
        ],
      }],
      working: 1,
    },
  },
  {
    args: makeArgs({text: '/graph'}),
    description: 'A missing query is reported',
    expected: {
      replies: [{
        options: {
          parse_mode: 'MarkdownV2',
          reply_markup: new InlineKeyboard().text('OK', 'remove-message'),
        },
        text: ['🤖 Missing graph query, try `/graph (public key/peer alias)`'],
      }],
      working: 1,
    },
  },
  {
    args: makeArgs({text: `/graph ${far}`}),
    description: 'A public key that is not in the graph is reported',
    expected: {
      replies: [{
        options: {
          parse_mode: 'MarkdownV2',
          reply_markup: new InlineKeyboard().text('OK', 'remove-message'),
        },
        text: [`🤖 \`${far}\` not found\\. Wrong public key?`],
      }],
      working: 1,
    },
  },
  {
    args: makeArgs({text: '/graph zed_*'}),
    description: 'A query that does not match a peer alias is reported',
    expected: {
      replies: [{
        options: {
          parse_mode: 'MarkdownV2',
          reply_markup: new InlineKeyboard().text('OK', 'remove-message'),
        },
        text: ['🤖 `zed\\_\\*` not found\\. Wrong public key?'],
      }],
      working: 1,
    },
  },
  {
    args: makeArgs({
      nodes: [{
        from: 'node1',
        lnd: makeLnd({methods: {getNodeInfo: ({}, cbk) => cbk('err')}}),
        public_key: key,
      }],
    }),
    description: 'A failure to look up the node is reported',
    expected: {
      replies: [{
        options: {
          parse_mode: 'MarkdownV2',
          reply_markup: new InlineKeyboard().text('OK', 'remove-message'),
        },
        text: ['🤖 Failed to find match: `FailedToRetrieveNodeDetails`'],
      }],
      working: 1,
    },
  },
  {
    args: makeArgs({text: `/graph ${mallory}`}),
    description: 'An error getting the alias of a peer is passed back',
    error: [400, 'ExpectedPublicKeyToGetNodeAliasFor'],
  },
];

tests.forEach(({args, description, error, expected}) => {
  return test(description, async () => {
    if (!!error) {
      await rejects(handleGraphCommand(args), error, 'Got expected error');
    } else {
      await handleGraphCommand(args);

      deepEqual(args.calls, expected, 'Got expected result');
    }

    return;
  });
});
