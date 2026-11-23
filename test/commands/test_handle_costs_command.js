const {deepEqual} = require('node:assert').strict;
const EventEmitter = require('node:events');
const {rejects} = require('node:assert').strict;
const test = require('node:test');

const {handleCostsCommand} = require('./../../');

const dayMs = 1000 * 60 * 60 * 24;
// Costs are measured with the real clock, so records are dated relative to it
const epochNsAgo = ms => (BigInt(Date.now() - ms) * BigInt(1e6)).toString();
const epochSecondsAgo = ms => Math.floor((Date.now() - ms) / 1e3).toString();
const hourMs = 1000 * 60 * 60;
const key = Buffer.alloc(33, 2).toString('hex');
const otherKey = Buffer.alloc(33, 3).toString('hex');
const peer = Buffer.alloc(33, 4).toString('hex');

const makeInvoice = ({ago, id}) => {
  return {
    add_index: '1',
    amt_paid_msat: '1000',
    amt_paid_sat: '1',
    cltv_expiry: '40',
    creation_date: epochSecondsAgo(ago),
    description_hash: Buffer.alloc(0),
    expiry: '3600',
    features: {},
    htlcs: [],
    is_keysend: true,
    memo: '',
    payment_addr: Buffer.alloc(32),
    r_hash: Buffer.alloc(32, id),
    r_preimage: Buffer.alloc(32),
    settle_date: epochSecondsAgo(ago),
    settle_index: '1',
    state: 'SETTLED',
    value: '1',
    value_msat: '1000',
  };
};

const makePayment = ({ago, fee, id}) => {
  return {
    creation_date: epochSecondsAgo(ago),
    creation_time_ns: epochNsAgo(ago),
    failure_reason: 'FAILURE_REASON_NONE',
    fee_msat: fee,
    htlcs: [{
      attempt_time_ns: epochNsAgo(ago),
      resolve_time_ns: epochNsAgo(ago),
      route: {
        hops: [
          {
            amt_to_forward_msat: '1000',
            chan_id: '1',
            expiry: 1,
            fee_msat: fee,
            pub_key: peer,
            tlv_payload: true,
          },
          {
            amt_to_forward_msat: '1000',
            chan_id: '2',
            expiry: 1,
            fee_msat: '0',
            pub_key: key,
            tlv_payload: true,
          },
        ],
        total_amt_msat: (BigInt(fee) + BigInt(1e3)).toString(),
        total_fees_msat: fee,
        total_time_lock: 1,
      },
      status: 'SUCCEEDED',
    }],
    payment_hash: Buffer.alloc(32, id).toString('hex'),
    payment_index: '1',
    payment_preimage: Buffer.alloc(32).toString('hex'),
    status: 'SUCCEEDED',
    value_msat: '1000',
    value_sat: '1',
  };
};

const makeTransaction = ({ago, confirmations, fee, id}) => {
  return {
    amount: '-1',
    block_hash: !confirmations ? '' : Buffer.alloc(32).toString('hex'),
    block_height: !confirmations ? 0 : 1,
    dest_addresses: ['address'],
    num_confirmations: confirmations,
    previous_outpoints: [],
    time_stamp: epochSecondsAgo(ago),
    total_fees: fee,
    tx_hash: Buffer.alloc(32, id).toString('hex'),
  };
};

const makeLnd = ({invoices, methods, payments, transactions}) => {
  const lnd = {
    chain: {
      registerBlockEpochNtfn: ({}) => {
        const emitter = new EventEmitter();

        emitter.cancel = () => {};

        process.nextTick(() => emitter.emit('data', {
          hash: Buffer.alloc(32),
          height: 1,
        }));

        return emitter;
      },
    },
    default: {
      closedChannels: ({}, cbk) => cbk(null, {channels: []}),
      getTransactions: ({}, cbk) => {
        return cbk(null, {transactions: transactions.map(makeTransaction)});
      },
      listInvoices: ({}, cbk) => cbk(null, {
        first_index_offset: '1',
        invoices: invoices.map(makeInvoice),
        last_index_offset: '1',
      }),
    },
    router: {
      trackPaymentV2: ({payment_hash}) => {
        const emitter = new EventEmitter();

        const payment = payments.find(({id}) => {
          return Buffer.alloc(32, id).equals(payment_hash);
        });

        emitter.cancel = () => {};

        // Exit early when the invoice was not paid by the node
        if (!payment) {
          process.nextTick(() => emitter.emit('error', {
            details: `payment isn't initiated`,
          }));

          return emitter;
        }

        process.nextTick(() => emitter.emit('data', makePayment(payment)));

        return emitter;
      },
    },
    wallet: {
      listSweeps: ({}, cbk) => cbk(null, {
        transaction_ids: {transaction_ids: []},
      }),
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
    nodes: [{
      from: 'node1',
      lnd: makeLnd({invoices: [], payments: [], transactions: []}),
      public_key: key,
    }],
    reply: text => calls.replies.push(text.split('\n')),
    request: ({}, cbk) => cbk('err'),
    working: () => calls.working++,
  };

  Object.keys(overrides).forEach(k => args[k] = overrides[k]);

  return args;
};

const tests = [
  {
    args: makeArgs({from: undefined}),
    description: 'A from user id is expected',
    error: [400, 'ExpectedFromUserIdNumberForCostsCommand'],
  },
  {
    args: makeArgs({reply: undefined}),
    description: 'A reply function is expected',
    error: [400, 'ExpectedReplyFunctionForCostsCommand'],
  },
  {
    args: makeArgs({request: undefined}),
    description: 'A request function is expected',
    error: [400, 'ExpectedRequestFunctionForCostsCommand'],
  },
  {
    args: makeArgs({working: undefined}),
    description: 'A working function is expected',
    error: [400, 'ExpectedWorkingFunctionForCostsCommand'],
  },
  {
    args: makeArgs({from: 2}),
    description: 'The command is only allowed for the connected user',
    error: [401, 'CommandRequiresConnectCode'],
  },
  {
    args: makeArgs({
      nodes: [{
        from: 'node1',
        lnd: makeLnd({
          invoices: [
            {ago: hourMs, id: 1},
            {ago: 2 * dayMs, id: 2},
            {ago: hourMs, id: 3},
          ],
          payments: [
            {ago: hourMs, fee: '2000', id: 1},
            {ago: 2 * dayMs, fee: '3000', id: 2},
          ],
          transactions: [
            {ago: hourMs, confirmations: 1, fee: '5', id: 1},
            {ago: 2 * dayMs, confirmations: 1, fee: '7', id: 2},
            {ago: 10 * dayMs, confirmations: 1, fee: '11', id: 3},
            {ago: hourMs, confirmations: 0, fee: '13', id: 4},
            {ago: hourMs, confirmations: 1, fee: '0', id: 5},
          ],
        }),
        public_key: key,
      }],
    }),
    description: 'Fees paid in the past day and week are posted',
    expected: {
      replies: [[
        '⚡️ Spent on node1',
        '',
        '```             Day         Week       ',
        ' Rebalances  0.00000002  0.00000005 ',
        ' Chain Fees  0.00000005  0.00000012 ',
        '',
        '```',
      ]],
      working: 1,
    },
  },
  {
    args: makeArgs({
      nodes: [
        {
          from: 'node1',
          lnd: makeLnd({invoices: [], payments: [], transactions: []}),
          public_key: key,
        },
        {
          from: 'node2',
          lnd: makeLnd({
            invoices: [],
            payments: [],
            transactions: [{ago: hourMs, confirmations: 1, fee: '5', id: 1}],
          }),
          public_key: otherKey,
        },
      ],
    }),
    description: 'Fees paid are posted for each node',
    expected: {
      replies: [[
        '⚡️ Spent on node1',
        '',
        '```- No fees paid in the past week```',
        '⚡️ Spent on node2',
        '',
        '```             Day         Week       ',
        ' Rebalances  -           -          ',
        ' Chain Fees  0.00000005  0.00000005 ',
        '',
        '```',
      ]],
      working: 1,
    },
  },
  {
    args: makeArgs({
      nodes: [{
        from: 'node1',
        lnd: makeLnd({
          invoices: [],
          methods: {listInvoices: ({}, cbk) => cbk('err')},
          payments: [],
          transactions: [],
        }),
        public_key: key,
      }],
    }),
    description: 'An error getting rebalances is passed back',
    error: [503, 'UnexpectedGetInvoicesError', {err: 'err'}],
  },
  {
    args: makeArgs({
      nodes: [{
        from: 'node1',
        lnd: makeLnd({
          invoices: [],
          methods: {getTransactions: ({}, cbk) => cbk('err')},
          payments: [],
          transactions: [],
        }),
        public_key: key,
      }],
    }),
    description: 'An error getting chain transactions is reported',
    expected: {
      replies: [[
        '⚡️ Spent on node1',
        '',
        '```             Day  Week ',
        ' Rebalances  -    -    ',
        '',
        '- Chain fees unavailable: UnexpectedGetChainTransactionsError',
        '```',
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
            invoices: [{ago: hourMs, id: 1}],
            methods: {getTransactions: ({}, cbk) => cbk('err')},
            payments: [{ago: hourMs, fee: '2000', id: 1}],
            transactions: [],
          }),
          public_key: key,
        },
        {
          from: 'node2',
          lnd: makeLnd({
            invoices: [],
            payments: [],
            transactions: [{ago: hourMs, confirmations: 1, fee: '5', id: 1}],
          }),
          public_key: otherKey,
        },
      ],
    }),
    description: 'A node with unknown chain fees keeps the other costs',
    expected: {
      replies: [[
        '⚡️ Spent on node1',
        '',
        '```             Day         Week       ',
        ' Rebalances  0.00000002  0.00000002 ',
        '',
        '- Chain fees unavailable: UnexpectedGetChainTransactionsError',
        '```',
        '⚡️ Spent on node2',
        '',
        '```             Day         Week       ',
        ' Rebalances  -           -          ',
        ' Chain Fees  0.00000005  0.00000005 ',
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
      await rejects(handleCostsCommand(args), error, 'Got expected error');
    } else {
      await handleCostsCommand(args);

      deepEqual(args.calls, expected, 'Got expected result');
    }

    return;
  });
});
