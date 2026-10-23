const {deepEqual} = require('node:assert').strict;
const EventEmitter = require('node:events');
const {rejects} = require('node:assert').strict;
const test = require('node:test');

const {handleEarningsCommand} = require('./../../');

const dayMs = 1000 * 60 * 60 * 24;
const hourMs = 1000 * 60 * 60;
const key1 = Buffer.alloc(33, 2).toString('hex');
const key2 = Buffer.alloc(33, 3).toString('hex');
const notFound = `payment isn't initiated`;
const secondsAgo = ms => Math.floor((Date.now() - ms) / 1e3);

// Make an LND forwarding event, given an age and a fee
const makeForward = ({ago, fee}) => {
  const at = secondsAgo(ago);

  return {
    amt_in: '2',
    amt_in_msat: '2000',
    amt_out: '1',
    amt_out_msat: '1000',
    chan_id_in: '1',
    chan_id_out: '2',
    fee: String(fee),
    fee_msat: String(fee * 1e3),
    timestamp: String(at),
    timestamp_ns: String(BigInt(at) * BigInt(1e9)),
  };
};

// Make an LND invoice, given its age, when it was paid and how much was paid
const makeInvoice = ({created, id, paid, received}) => {
  return {
    add_index: String(id),
    amt_paid_msat: String((received || 0) * 1e3),
    amt_paid_sat: String(received || 0),
    cltv_expiry: '40',
    creation_date: String(secondsAgo(created)),
    description_hash: Buffer.alloc(0),
    expiry: '3600',
    fallback_addr: '',
    features: {},
    htlcs: [],
    is_keysend: true,
    memo: '',
    payment_addr: Buffer.alloc(32),
    payment_request: '',
    private: false,
    r_hash: Buffer.alloc(32, id),
    r_preimage: Buffer.alloc(32),
    settle_date: !paid ? '0' : String(secondsAgo(paid)),
    settle_index: !paid ? '0' : String(id),
    settled: !!paid,
    state: !paid ? 'OPEN' : 'SETTLED',
    value: '0',
    value_msat: '0',
  };
};

// Make an LND succeeded payment
const makePayment = ({id}) => {
  return {
    creation_date: '1',
    creation_time_ns: '1',
    failure_reason: 'FAILURE_REASON_NONE',
    fee: '0',
    fee_msat: '0',
    fee_sat: '0',
    htlcs: [{
      attempt_time_ns: '1',
      resolve_time_ns: '1',
      route: {
        hops: [{
          amt_to_forward_msat: '1000',
          chan_id: '1',
          expiry: 1,
          fee_msat: '0',
          pub_key: key2,
          tlv_payload: true,
        }],
        total_amt_msat: '1000',
        total_fees_msat: '0',
        total_time_lock: 1,
      },
      status: 'SUCCEEDED',
    }],
    payment_hash: id,
    payment_index: '1',
    payment_preimage: Buffer.alloc(32).toString('hex'),
    payment_request: '',
    status: 'SUCCEEDED',
    value: '1',
    value_msat: '1000',
    value_sat: '1',
  };
};

const makeLnd = ({err, forwards, pages, paid}) => {
  return {
    default: {
      forwardingHistory: ({}, cbk) => {
        if (!forwards) {
          return cbk('err');
        }

        return cbk(null, {
          forwarding_events: forwards.map(makeForward),
          last_offset_index: '0',
        });
      },
      listInvoices: ({index_offset}, cbk) => {
        // Pages of invoices are found by the index offset to page back from
        const page = pages[index_offset];

        if (!page) {
          return cbk('err');
        }

        return cbk(null, {
          first_index_offset: page.first_index_offset,
          invoices: page.invoices.map(makeInvoice),
          last_index_offset: '0',
        });
      },
    },
    router: {
      trackPaymentV2: ({payment_hash}) => {
        const emitter = new EventEmitter();
        const id = payment_hash.toString('hex');

        emitter.cancel = () => {};

        // Exit early when looking up the payment fails
        if (!!err) {
          process.nextTick(() => emitter.emit('error', err));

          return emitter;
        }

        // Payments are only found when they were paid by this node
        if (!(paid || []).includes(id)) {
          process.nextTick(() => emitter.emit('error', {details: notFound}));
        } else {
          process.nextTick(() => emitter.emit('data', makePayment({id})));
        }

        return emitter;
      },
    },
  };
};

const makeArgs = (overrides, workingErr) => {
  const calls = {replies: [], working: 0};

  const args = {
    calls,
    from: 1,
    id: 1,
    nodes: [{
      from: 'node',
      lnd: makeLnd({
        forwards: [{ago: hourMs, fee: 1}],
        pages: {0: {first_index_offset: '1', invoices: []}},
      }),
      public_key: key1,
    }],
    reply: text => calls.replies.push(text.split('\n')),
    working: async () => {
      calls.working++;

      if (!!workingErr) {
        throw new Error(workingErr);
      }

      return;
    },
  };

  Object.keys(overrides).forEach(k => args[k] = overrides[k]);

  return args;
};

const tests = [
  {
    args: makeArgs({from: undefined}),
    description: 'Earnings command requires from id',
    error: [400, 'ExpectedFromUserIdNumberForEarningsCommand'],
  },
  {
    args: makeArgs({reply: undefined}),
    description: 'Earnings command requires a reply function',
    error: [400, 'ExpectedReplyFunctionForEarningsCommand'],
  },
  {
    args: makeArgs({working: undefined}),
    description: 'Earnings command requires a working function',
    error: [400, 'ExpectedWorkingFunctionForEarningsCommand'],
  },
  {
    args: makeArgs({from: 2}),
    description: 'Earnings command requires the connected user',
    error: [401, 'CommandRequiresConnectCode'],
  },
  {
    args: makeArgs({
      nodes: [{
        from: 'node',
        lnd: makeLnd({forwards: [], pages: {}}),
        public_key: key1,
      }],
    }),
    description: 'An error getting invoices is passed back',
    error: [503, 'UnexpectedGetInvoicesError', {err: 'err'}],
  },
  {
    args: makeArgs({
      nodes: [{
        from: 'node',
        lnd: makeLnd({pages: {0: {first_index_offset: '1', invoices: []}}}),
        public_key: key1,
      }],
    }),
    description: 'An error getting forwards is passed back',
    error: [503, 'GetForwardingHistoryError', {err: 'err'}],
  },
  {
    args: makeArgs({
      nodes: [{
        from: 'node',
        lnd: makeLnd({
          err: {details: 'err'},
          forwards: [],
          pages: {
            0: {
              first_index_offset: '1',
              invoices: [{created: hourMs, id: 1, paid: hourMs, received: 1}],
            },
          },
        }),
        public_key: key1,
      }],
    }),
    description: 'An error checking for a self-payment is passed back',
    error: [503, 'UnexpectedGetPaymentError', {err: {details: 'err'}}],
  },
  {
    args: makeArgs({}),
    description: 'Earnings command is handled',
    expected: {
      replies: [[
        '💰 Earned on node',
        '',
        '```           Day         Week       ',
        ' Routing   0.00000001  0.00000001 ',
        ' Invoiced  -           -          ',
        '',
        '```',
      ]],
      working: 1,
    },
  },
  {
    args: makeArgs({}, 'err'),
    description: 'A failure to notify of working is ignored',
    expected: {
      replies: [[
        '💰 Earned on node',
        '',
        '```           Day         Week       ',
        ' Routing   0.00000001  0.00000001 ',
        ' Invoiced  -           -          ',
        '',
        '```',
      ]],
      working: 1,
    },
  },
  {
    args: makeArgs({
      nodes: [{
        from: 'node',
        lnd: makeLnd({
          forwards: [{ago: hourMs, fee: 1}, {ago: 2 * dayMs, fee: 2}],
          pages: {
            0: {
              first_index_offset: '3',
              invoices: [
                {created: hourMs, id: 3, paid: hourMs, received: 3},
                {created: hourMs, id: 4},
              ],
            },
            3: {
              first_index_offset: '2',
              invoices: [
                {created: 8 * dayMs, id: 1, paid: 8 * dayMs, received: 5},
                {created: 3 * dayMs, id: 2, paid: 2 * dayMs, received: 4},
              ],
            },
          },
        }),
        public_key: key1,
      }],
    }),
    description: 'Earnings of the past day and week are posted',
    expected: {
      replies: [[
        '💰 Earned on node',
        '',
        '```           Day         Week       ',
        ' Routing   0.00000001  0.00000003 ',
        ' Invoiced  0.00000003  0.00000007 ',
        '',
        '```',
      ]],
      working: 1,
    },
  },
  {
    args: makeArgs({
      nodes: [{
        from: 'node',
        lnd: makeLnd({
          forwards: [],
          pages: {0: {first_index_offset: '1', invoices: []}},
        }),
        public_key: key1,
      }],
    }),
    description: 'A lack of earnings is posted',
    expected: {
      replies: [[
        '💰 Earned on node',
        '',
        '```- No earnings in the past week```',
      ]],
      working: 1,
    },
  },
  {
    args: makeArgs({
      nodes: [
        {
          from: 'node1',
          lnd: makeLnd({
            forwards: [],
            pages: {0: {first_index_offset: '1', invoices: []}},
            paid: [Buffer.alloc(32, 1).toString('hex')],
          }),
          public_key: key1,
        },
        {
          from: 'node2',
          lnd: makeLnd({
            forwards: [],
            pages: {
              0: {
                first_index_offset: '1',
                invoices: [
                  {created: hourMs, id: 1, paid: hourMs, received: 5},
                  {created: hourMs, id: 2, paid: hourMs, received: 1},
                ],
              },
            },
          }),
          public_key: key2,
        },
      ],
    }),
    description: 'Payments between own nodes are not counted as earnings',
    expected: {
      replies: [[
        '💰 Earned on node1',
        '',
        '```- No earnings in the past week```',
        '💰 Earned on node2',
        '',
        '```           Day         Week       ',
        ' Routing   -           -          ',
        ' Invoiced  0.00000001  0.00000001 ',
        '',
        '```',
      ]],
      working: 1,
    },
  },
];

tests.forEach(({args, description, error, expected}) => {
  return test(description, async () => {
    if (!!error) {
      await rejects(handleEarningsCommand(args), error, 'Got expected error');
    } else {
      await handleEarningsCommand(args);

      deepEqual(args.calls, expected, 'Got expected result');
    }

    return;
  });
});
