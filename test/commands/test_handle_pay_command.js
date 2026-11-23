const {deepEqual} = require('node:assert').strict;
const EventEmitter = require('node:events');
const {rejects} = require('node:assert').strict;
const test = require('node:test');

const {getInfoResponse} = require('./../fixtures');
const {handlePayCommand} = require('./../../');
const {key: destination} = require('./../fixtures/encoded');
const {payRequest: request} = require('./../fixtures/encoded');
const {request: requestWithoutSecret} = require('./../fixtures/encoded');

const key = Buffer.alloc(33, 3).toString('hex');
const otherKey = Buffer.alloc(33, 4).toString('hex');
const peer = Buffer.alloc(33, 2).toString('hex');
const unpostable = 'unpostable';

const makeFailure = ({code, index}) => {
  return {failure: {code, failure_source_index: index}, status: 'FAILED'};
};

const makeHops = ({fee}) => {
  return [
    {
      amt_to_forward_msat: '10000',
      chan_id: '1099511693313',
      expiry: 40,
      fee_msat: (fee * 1e3).toString(),
      pub_key: peer,
      tlv_payload: true,
    },
    {
      amt_to_forward_msat: '10000',
      chan_id: '2199023386626',
      expiry: 40,
      fee_msat: '0',
      pub_key: destination,
      tlv_payload: true,
    },
  ];
};

const makeRoute = ({fee}) => {
  return {
    hops: makeHops({fee}),
    total_amt_msat: (1e4 + fee * 1e3).toString(),
    total_fees_msat: (fee * 1e3).toString(),
    total_time_lock: 50,
  };
};

const makePayment = ({reason, status}) => {
  return {
    status,
    creation_date: '1',
    creation_time_ns: '1000000000',
    failure_reason: reason || 'FAILURE_REASON_NONE',
    fee_msat: '1000',
    htlcs: [{
      status,
      attempt_time_ns: '1000000000',
      resolve_time_ns: '1000000000',
      route: makeRoute({fee: 1}),
    }],
    payment_hash: Buffer.alloc(32).toString('hex'),
    payment_index: '1',
    payment_preimage: Buffer.alloc(32).toString('hex'),
    value_msat: '10000',
    value_sat: '10',
  };
};

const makeLnd = ({attempts, err, graph, reason, routes, status}) => {
  return {
    default: {
      deletePayment: ({}, cbk) => cbk(),
      getInfo: ({}, cbk) => cbk(null, getInfoResponse),
      getNodeInfo: ({pub_key}, cbk) => {
        const node = (graph || []).find(n => n.public_key === pub_key);

        // Exit early when the node is not in the graph
        if (!node) {
          return cbk({details: 'unable to find node'});
        }

        return cbk(null, {
          channels: [],
          node: {
            pub_key,
            addresses: [],
            alias: node.alias,
            color: '#000000',
            features: {},
            last_update: 1,
          },
          num_channels: 1,
          total_capacity: '1',
        });
      },
      queryRoutes: ({}, cbk) => cbk(null, {routes: routes.splice(0, 1)}),
    },
    router: {
      sendToRouteV2: ({}, cbk) => cbk(null, attempts.shift()),
      trackPaymentV2: ({}) => {
        const emitter = new EventEmitter();

        emitter.cancel = () => {};

        // Exit early when there is an error looking up the payment
        if (!!err) {
          process.nextTick(() => emitter.emit('error', err));

          return emitter;
        }

        process.nextTick(() => {
          return emitter.emit('data', makePayment({reason, status}));
        });

        return emitter;
      },
    },
  };
};

const makeArgs = overrides => {
  const calls = {replies: []};

  const args = {
    calls,
    budget: 100,
    from: 1,
    id: 1,
    nodes: [{
      from: 'node1',
      lnd: makeLnd({
        attempts: [
          makeFailure({code: 'UNKNOWN_PAYMENT_HASH', index: 2}),
          {preimage: Buffer.alloc(32), status: 'SUCCEEDED'},
        ],
        routes: [makeRoute({fee: 1})],
        status: 'SUCCEEDED',
      }),
      public_key: key,
    }],
    // Posting a message that mentions the unpostable alias fails
    reply: async text => {
      calls.replies.push(text.split('\n'));

      if (text.includes(unpostable)) {
        throw new Error('FailedToPostReply');
      }

      return;
    },
    text: `/pay ${request}`,
  };

  Object.keys(overrides).forEach(k => args[k] = overrides[k]);

  return args;
};

const tests = [
  {
    args: makeArgs({budget: undefined}),
    description: 'A budget is expected',
    error: [400, 'ExpectedTokensLimitForPayCommand'],
    expected: {replies: []},
  },
  {
    args: makeArgs({from: undefined}),
    description: 'A from user id is expected',
    error: [400, 'ExpectedCommandFromUserIdNumberToPayCommand'],
    expected: {replies: []},
  },
  {
    args: makeArgs({nodes: undefined}),
    description: 'An array of nodes is expected',
    error: [400, 'ExpectedNodesForPayCommand'],
    expected: {replies: []},
  },
  {
    args: makeArgs({nodes: []}),
    description: 'A node to pay with is expected',
    error: [400, 'ExpectedNodesForPayCommand'],
    expected: {replies: []},
  },
  {
    args: makeArgs({reply: undefined}),
    description: 'A reply function is expected',
    error: [400, 'ExpectedReplyFunctionForPayCommand'],
    expected: {replies: []},
  },
  {
    args: makeArgs({text: undefined}),
    description: 'The command text is expected',
    error: [400, 'ExpectedOriginalCommandTextForPayCommand'],
    expected: {replies: []},
  },
  {
    args: makeArgs({from: 2}),
    description: 'The command is only allowed for the connected user',
    error: [401, 'CommandRequiresConnectCode'],
    expected: {replies: []},
  },
  {
    args: makeArgs({}),
    description: 'A payment is sent',
    expected: {
      payment: {
        fee: 1,
        hops: [
          {
            channel: '1x1x1',
            fee: 1,
            fee_mtokens: '1000',
            forward: 10,
            forward_mtokens: '10000',
            public_key: peer,
            timeout: 40,
          },
          {
            channel: '2x2x2',
            fee: 0,
            fee_mtokens: '0',
            forward: 10,
            forward_mtokens: '10000',
            public_key: destination,
            timeout: 40,
          },
        ],
        tokens: 11,
      },
      replies: [['🤖 Paying 10...'], ['Sent 10! Fee: 1.']],
    },
  },
  {
    args: makeArgs({
      nodes: [
        {
          from: 'node1',
          lnd: makeLnd({attempts: [], routes: [], status: 'SUCCEEDED'}),
          public_key: key,
        },
        {
          from: 'node2',
          lnd: makeLnd({
            attempts: [
              makeFailure({code: 'UNKNOWN_PAYMENT_HASH', index: 2}),
              {preimage: Buffer.alloc(32), status: 'SUCCEEDED'},
            ],
            routes: [makeRoute({fee: 1})],
            status: 'SUCCEEDED',
          }),
          public_key: otherKey,
        },
      ],
      text: `/pay 2 ${request}`,
    }),
    description: 'A payment is sent with the selected node',
    expected: {
      payment: {
        fee: 1,
        hops: [
          {
            channel: '1x1x1',
            fee: 1,
            fee_mtokens: '1000',
            forward: 10,
            forward_mtokens: '10000',
            public_key: peer,
            timeout: 40,
          },
          {
            channel: '2x2x2',
            fee: 0,
            fee_mtokens: '0',
            forward: 10,
            forward_mtokens: '10000',
            public_key: destination,
            timeout: 40,
          },
        ],
        tokens: 11,
      },
      replies: [['🤖 Paying 10...'], ['Sent 10! Fee: 1.']],
    },
  },
  {
    args: makeArgs({
      nodes: [
        {
          from: 'node1',
          lnd: makeLnd({attempts: [], routes: [], status: 'SUCCEEDED'}),
          public_key: key,
        },
        {
          from: 'node2',
          lnd: makeLnd({attempts: [], routes: [], status: 'SUCCEEDED'}),
          public_key: otherKey,
        },
      ],
    }),
    description: 'A node to pay with must be selected when there are many',
    expected: {
      payment: {tokens: 0},
      replies: [
        [
          'Node to pay with?',
          '- 1: node1',
          '- 2: node2',
          '/pay <node #> <payment request> \\[max payment amount]',
        ],
        ['Specify node to pay with...'],
      ],
    },
  },
  {
    args: makeArgs({text: '/pay request'}),
    description: 'A payment request that cannot be decoded is reported',
    expected: {
      payment: {tokens: 0},
      replies: [['Could not decode payment request, is it pasted correctly?']],
    },
  },
  {
    args: makeArgs({text: `/pay ${request} limit`}),
    description: 'A payment limit that is not a number is reported',
    expected: {
      payment: {tokens: 0},
      replies: [
        [
          'Missing payment limit amount',
          '/pay <payment request> \\[max payment amount]',
        ],
      ],
    },
  },
  {
    args: makeArgs({text: `/pay ${request} 9`}),
    description: 'A payment limit lower than the amount is reported',
    expected: {
      payment: {tokens: 0},
      replies: [['Payment amount higher than limit specified.']],
    },
  },
  {
    args: makeArgs({budget: 9}),
    description: 'A budget lower than the amount is reported',
    expected: {
      payment: {tokens: 0},
      replies: [['Payment amount higher than budget. Try a lower amount?']],
    },
  },
  {
    args: makeArgs({
      nodes: [{
        from: 'node1',
        lnd: makeLnd({attempts: [], routes: [], status: 'SUCCEEDED'}),
        public_key: key,
      }],
      text: `/pay ${requestWithoutSecret}`,
    }),
    description: 'A payment with no route to the destination is reported',
    expected: {
      payment: {tokens: 0},
      replies: [
        ['🤖 Paying 1...'],
        ['No route to payment destination, create a new channel?'],
      ],
    },
  },
  {
    args: makeArgs({
      nodes: [{
        from: 'node1',
        lnd: {
          default: {
            getInfo: ({}, cbk) => cbk(null, getInfoResponse),
            queryRoutes: ({}, cbk) => cbk('err'),
          },
          router: {sendToRouteV2: ({}, cbk) => cbk('err')},
        },
        public_key: key,
      }],
    }),
    description: 'An error finding a route is passed back',
    error: [503, 'UnexpectedErrInGetRouteToDestination', {err: 'err'}],
    expected: {replies: [['🤖 Paying 10...']]},
  },
  {
    args: makeArgs({
      nodes: [{
        from: 'node1',
        lnd: makeLnd({
          attempts: [makeFailure({code: 'UNKNOWN_PAYMENT_HASH', index: 2})],
          routes: [makeRoute({fee: 2})],
          status: 'SUCCEEDED',
        }),
        public_key: key,
      }],
    }),
    description: 'A route with fees over the payment limit is reported',
    expected: {
      payment: {tokens: 0},
      replies: [['🤖 Paying 10...'], ['Higher payment limit needed: 12']],
    },
  },
  {
    args: makeArgs({
      nodes: [{
        from: 'node1',
        lnd: makeLnd({
          attempts: [
            makeFailure({code: 'TEMPORARY_CHANNEL_FAILURE', index: 1}),
            makeFailure({code: 'UNKNOWN_PAYMENT_HASH', index: 2}),
            {preimage: Buffer.alloc(32), status: 'SUCCEEDED'},
          ],
          graph: [{alias: 'alice', public_key: peer}],
          routes: [makeRoute({fee: 1}), makeRoute({fee: 1})],
          status: 'SUCCEEDED',
        }),
        public_key: key,
      }],
    }),
    description: 'A routing failure shows the alias of the failed node',
    expected: {
      payment: {
        fee: 1,
        hops: [
          {
            channel: '1x1x1',
            fee: 1,
            fee_mtokens: '1000',
            forward: 10,
            forward_mtokens: '10000',
            public_key: peer,
            timeout: 40,
          },
          {
            channel: '2x2x2',
            fee: 0,
            fee_mtokens: '0',
            forward: 10,
            forward_mtokens: '10000',
            public_key: destination,
            timeout: 40,
          },
        ],
        tokens: 11,
      },
      replies: [
        ['🤖 Paying 10...'],
        ['Sent 10! Fee: 1.'],
        // The failure is posted after looking up the alias of the failed node
        ['TemporaryChannelFailure at 2x2x2 from alice'],
      ],
    },
  },
  {
    args: makeArgs({
      nodes: [{
        from: 'node1',
        lnd: makeLnd({
          attempts: [
            makeFailure({code: 'TEMPORARY_CHANNEL_FAILURE', index: 1}),
          ],
          graph: [{alias: '', public_key: peer}],
          routes: [makeRoute({fee: 1})],
          status: 'SUCCEEDED',
        }),
        public_key: key,
      }],
    }),
    description: 'A routing failure shows the key of a node without an alias',
    expected: {
      payment: {tokens: 0},
      replies: [
        ['🤖 Paying 10...'],
        ['No route to payment destination, create a new channel?'],
        // The failure is posted after looking up the alias of the failed node
        [`TemporaryChannelFailure at 2x2x2 from ${peer}`],
      ],
    },
  },
  {
    args: makeArgs({
      nodes: [{
        from: 'node1',
        lnd: makeLnd({
          attempts: [
            makeFailure({code: 'TEMPORARY_CHANNEL_FAILURE', index: 1}),
          ],
          graph: [],
          routes: [makeRoute({fee: 1})],
          status: 'SUCCEEDED',
        }),
        public_key: key,
      }],
    }),
    description: 'A routing failure shows the key of a node not in the graph',
    expected: {
      payment: {tokens: 0},
      replies: [
        ['🤖 Paying 10...'],
        ['No route to payment destination, create a new channel?'],
        // The failure is posted after looking up the alias of the failed node
        [`TemporaryChannelFailure at 2x2x2 from ${peer}`],
      ],
    },
  },
  {
    args: makeArgs({
      nodes: [{
        from: 'node1',
        lnd: makeLnd({
          attempts: [
            makeFailure({code: 'TEMPORARY_CHANNEL_FAILURE', index: 1}),
          ],
          graph: [{alias: '[a](http://1/) my_node *`', public_key: peer}],
          routes: [makeRoute({fee: 1})],
          status: 'SUCCEEDED',
        }),
        public_key: key,
      }],
    }),
    description: 'A routing failure alias cannot add formatting or links',
    expected: {
      payment: {tokens: 0},
      replies: [
        ['🤖 Paying 10...'],
        ['No route to payment destination, create a new channel?'],
        // The failure is posted after looking up the alias of the failed node
        ['TemporaryChannelFailure at 2x2x2 from \\[a](http://1/) my\\_node \\*\\`'],
      ],
    },
  },
  {
    args: makeArgs({
      nodes: [{
        from: 'node1',
        lnd: makeLnd({
          attempts: [
            makeFailure({code: 'TEMPORARY_CHANNEL_FAILURE', index: 1}),
          ],
          graph: [{alias: unpostable, public_key: peer}],
          routes: [makeRoute({fee: 1})],
          status: 'SUCCEEDED',
        }),
        public_key: key,
      }],
    }),
    description: 'A failure to post a routing failure is ignored',
    expected: {
      payment: {tokens: 0},
      replies: [
        ['🤖 Paying 10...'],
        ['No route to payment destination, create a new channel?'],
        // The failure is posted after looking up the alias of the failed node
        ['TemporaryChannelFailure at 2x2x2 from unpostable'],
      ],
    },
  },
  {
    args: makeArgs({
      nodes: [{
        from: 'node1',
        lnd: makeLnd({
          attempts: [
            makeFailure({code: 'TEMPORARY_CHANNEL_FAILURE', index: 0}),
          ],
          routes: [makeRoute({fee: 1})],
          status: 'SUCCEEDED',
        }),
        public_key: key,
      }],
    }),
    description: 'A routing failure at the first hop has no failed node',
    expected: {
      payment: {tokens: 0},
      replies: [
        ['🤖 Paying 10...'],
        ['TemporaryChannelFailure at 1x1x1'],
        ['No route to payment destination, create a new channel?'],
      ],
    },
  },
  {
    args: makeArgs({
      nodes: [{
        from: 'node1',
        lnd: makeLnd({
          attempts: [
            makeFailure({code: 'UNKNOWN_PAYMENT_HASH', index: 2}),
            makeFailure({code: 'TEMPORARY_CHANNEL_FAILURE', index: 1}),
          ],
          reason: 'FAILURE_REASON_NO_ROUTE',
          routes: [makeRoute({fee: 1})],
          status: 'FAILED',
        }),
        public_key: key,
      }],
    }),
    description: 'A payment that failed to send is reported',
    expected: {
      payment: {tokens: 0},
      replies: [['🤖 Paying 10...'], ['Payment failed to send. Try again?']],
    },
  },
  {
    args: makeArgs({
      nodes: [{
        from: 'node1',
        lnd: makeLnd({
          attempts: [
            makeFailure({code: 'UNKNOWN_PAYMENT_HASH', index: 2}),
            makeFailure({
              code: 'INCORRECT_OR_UNKNOWN_PAYMENT_DETAILS',
              index: 2,
            }),
          ],
          reason: 'FAILURE_REASON_INCORRECT_PAYMENT_DETAILS',
          routes: [makeRoute({fee: 1})],
          status: 'FAILED',
        }),
        public_key: key,
      }],
    }),
    description: 'A payment the receiver rejects is reported',
    expected: {
      payment: {tokens: 0},
      replies: [
        ['🤖 Paying 10...'],
        ['The receiver rejected the payment. Try again?'],
      ],
    },
  },
  {
    args: makeArgs({
      nodes: [{
        from: 'node1',
        lnd: makeLnd({
          attempts: [
            makeFailure({code: 'UNKNOWN_PAYMENT_HASH', index: 2}),
            {status: 'IN_FLIGHT'},
          ],
          routes: [makeRoute({fee: 1})],
          status: 'IN_FLIGHT',
        }),
        public_key: key,
      }],
    }),
    description: 'A payment that is stuck pending is passed back',
    error: [503, 'PaymentStuckInPendingState'],
    expected: {replies: [['🤖 Paying 10...'], ['⚠️ Payment is pending']]},
  },
  {
    args: makeArgs({
      nodes: [{
        from: 'node1',
        lnd: makeLnd({
          attempts: [
            makeFailure({code: 'UNKNOWN_PAYMENT_HASH', index: 2}),
            {preimage: Buffer.alloc(32), status: 'SUCCEEDED'},
          ],
          err: 'err',
          routes: [makeRoute({fee: 1})],
        }),
        public_key: key,
      }],
    }),
    description: 'An error getting the payment status is passed back',
    error: [503, 'UnexpectedGetPaymentError', {err: 'err'}],
    expected: {replies: [['🤖 Paying 10...']]},
  },
];

tests.forEach(({args, description, error, expected}) => {
  return test(description, async () => {
    if (!!error) {
      await rejects(handlePayCommand(args), error, 'Got expected error');
    } else {
      const res = await handlePayCommand(args);

      deepEqual(res, expected.payment, 'Got expected payment');
    }

    deepEqual(args.calls.replies, expected.replies, 'Got expected replies');

    return;
  });
});
