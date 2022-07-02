const EventEmitter = require('events');

const {test} = require('@alexbosworth/tap');

const {postSettledInvoice} = require('./../../');

const makeInvoice = overrides => {
  const invoice = {
    description: 'description',
    id: Buffer.alloc(32).toString('hex'),
    is_confirmed: true,
    payments: [{
      confirmed_at: new Date(1).toISOString(),
      created_at: new Date(1).toISOString(),
      created_height: 1,
      in_channel: '0x0x1',
      is_canceled: false,
      is_confirmed: true,
      is_held: false,
      messages: [{
        type: '34349334',
        value: Buffer.from('message').toString('hex'),
      }],
      mtokens: '1000',
      tokens: 1,
      total_mtokens: '1000',
    }],
    received_mtokens: 1000,
  };

  Object.keys(overrides).forEach(k => invoice[k] = overrides[k]);

  return invoice;
};

const makeLndVersion = ({}) => {
  return {
    getVersion: ({}, cbk) => {
      return cbk(null, {});
    },
  };
};

const makeLndDefault = ({}) => {
  return {
    getNodeInfo: ({}, cbk) => cbk('err'),
    listChannels: ({}, cbk) => cbk(null, {
      channels: [{
        active: true,
        capacity: 1,
        chan_id: '1',
        channel_point: '00:1',
        close_address: 'cooperative_close_address',
        commit_fee: '1',
        commit_weight: '1',
        commitment_type: 'LEGACY',
        fee_per_kw: '1',
        initiator: true,
        local_balance: '1',
        local_chan_reserve_sat: '1',
        local_constraints: {
          chan_reserve_sat: '1',
          csv_delay: 1,
          dust_limit_sat: '1',
          max_accepted_htlcs: 1,
          max_pending_amt_msat: '1',
          min_htlc_msat: '1',
        },
        num_updates: 1,
        pending_htlcs: [{
          amount: '1',
          expiration_height: 1,
          hash_lock: Buffer.alloc(32),
          incoming: true,
        }],
        private: true,
        remote_balance: 1,
        remote_chan_reserve_sat: '1',
        remote_constraints: {
          chan_reserve_sat: '1',
          csv_delay: 1,
          dust_limit_sat: '1',
          max_accepted_htlcs: 1,
          max_pending_amt_msat: '1',
          min_htlc_msat: '1',
        },
        remote_pubkey: Buffer.alloc(33).toString('hex'),
        thaw_height: 0,
        total_satoshis_received: 1,
        total_satoshis_sent: 1,
        unsettled_balance: 1,
      }],
    }),
  };
};

const makeArgs = overrides => {
  const args = {
    from: 'from',
    id: 1,
    invoice: makeInvoice({}),
    key: 'key',
    lnd: {
      default: makeLndDefault({}),
      router: {
        trackPaymentV2: ({}) => {
          const emitter = new EventEmitter();

          process.nextTick(() => emitter.emit('data', {
            creation_date: '1',
            creation_time_ns: '1',
            failure_reason: 'FAILURE_REASON_NONE',
            fee: '1',
            fee_msat: '1000',
            fee_sat: '1',
            htlcs: [{
              attempt_time_ns: '1',
              status: 'SUCCEEDED',
              resolve_time_ns: '1',
              route: {
                hops: [{
                  amt_to_forward: '1',
                  amt_to_forward_msat: '1000',
                  chan_capacity: '1',
                  chan_id: '1',
                  custom_records: {'1': Buffer.alloc(1)},
                  expiry: 1,
                  fee: '1',
                  fee_msat: '1000',
                  mpp_record: {
                    payment_addr: Buffer.alloc(32),
                    total_amt_msat: '1000',
                  },
                  pub_key: Buffer.alloc(33).toString('hex'),
                  tlv_payload: true,
                }],
                total_amt: '1',
                total_amt_msat: '1000',
                total_time_lock: 1,
                total_fees: '1',
                total_fees_msat: '1000',
              },
            }],
            path: [Buffer.alloc(33).toString('hex')],
            payment_hash: Buffer.alloc(32).toString('hex'),
            payment_index: '1',
            payment_preimage: Buffer.alloc(32).toString('hex'),
            payment_request: '',
            status: 'SUCCEEDED',
            value: '1',
            value_msat: '1000',
            value_sat: '1',
          }));

          return emitter;
        },
      },
      version: makeLndVersion({}),
    },
    nodes: [],
    quiz: () => {},
    send: () => new Promise(resolve => resolve()),
  };

  Object.keys(overrides).forEach(k => args[k] = overrides[k]);

  return args;
};

const tests = [
  {
    args: makeArgs({from: undefined}),
    description: 'From node is required to post settled invoice',
    error: [400, 'ExpectedFromNameToPostSettledInvoice'],
  },
  {
    args: makeArgs({id: undefined}),
    description: 'User id is required to post settled invoice',
    error: [400, 'ExpectedUserIdNumberToPostSettledInvoice'],
  },
  {
    args: makeArgs({invoice: undefined}),
    description: 'Invoice details are required to post settled invoice',
    error: [400, 'ExpectedInvoiceToPostSettledInvoice'],
  },
  {
    args: makeArgs({key: undefined}),
    description: 'A node key is required to post settled invoice',
    error: [400, 'ExpectedNodeIdentityKeyToPostSettledInvoice'],
  },
  {
    args: makeArgs({lnd: undefined}),
    description: 'An LND object is required to post settled invoice',
    error: [400, 'ExpectedLndObjectToPostSettledInvoice'],
  },
  {
    args: makeArgs({send: undefined}),
    description: 'Send is required to post settled invoice',
    error: [400, 'ExpectedSendFunctionToPostSettledInvoice'],
  },
  {
    args: makeArgs({}),
    description: 'A settled invoice is posted',
  },
  {
    args: makeArgs({invoice: makeInvoice({is_confirmed: false})}),
    description: 'An unsettled invoice is not posted',
  },
  {
    args: makeArgs({
      lnd: {
        default: makeLndDefault({}),
        router: {
          trackPaymentV2: ({}) => {
            const emitter = new EventEmitter();

            process.nextTick(() => emitter.emit('data', {
              status: 'IN_FLIGHT',
            }));

            return emitter;
          },
        },
        version: makeLndVersion({}),
      },
    }),
    description: 'A settled invoice is posted that has no payment',
  },
  {
    args: makeArgs({
      lnd: {
        default: makeLndDefault({}),
        router: {
          trackPaymentV2: ({}) => {
            const emitter = new EventEmitter();

            process.nextTick(() => emitter.emit('error', 'err'));

            return emitter;
          },
        },
        version: makeLndVersion({}),
      },
    }),
    description: 'A settled invoice is posted which is not a rebalance',
  },
];

tests.forEach(({args, description, error, expected}) => {
  return test(description, async ({end, equal, rejects}) => {
    if (!!error) {
      await rejects(postSettledInvoice(args), error, 'Got expected error');
    } else {
      process.nextTick(async () => {
        await postSettledInvoice(args);
      });
    }

    return end();
  });
});
