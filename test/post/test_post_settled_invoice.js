const {deepEqual} = require('node:assert').strict;
const EventEmitter = require('node:events');
const {rejects} = require('node:assert').strict;
const test = require('node:test');

const {postSettledInvoice} = require('./../../');
const {request: acceptRequest} = require('./../fixtures/encoded');


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
    received: 1,
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
    getChanInfo: ({}, cbk) => {
      return cbk(null, {
        capacity: '1',
        chan_point: `${Buffer.alloc(32).toString('hex')}:0`,
        channel_id: '000000000',
        node1_policy: {
          disabled: true,
          fee_base_msat: '1',
          fee_rate_milli_msat: '1',
          last_update: 1,
          max_htlc_msat: '1',
          min_htlc: '1',
          time_lock_delta: 1,
        },
        node1_pub: Buffer.alloc(33).toString('hex'),
        node2_policy: {
          disabled: false,
          fee_base_msat: '2',
          fee_rate_milli_msat: '2',
          last_update: 1,
          max_htlc_msat: '2',
          min_htlc: '2',
          time_lock_delta: 2,
        },
        node2_pub: Buffer.alloc(33, 1).toString('hex'),
      });
    },
    getNodeInfo: ({}, cbk) => cbk('err'),
    listChannels: ({}, cbk) => cbk(null, {
      channels: [{
        active: true,
        alias_scids: [],
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

const makeLndRouter = ({err, status}) => {
  return {
    trackPaymentV2: ({}) => {
      const emitter = new EventEmitter();

      // Exit early when there is an error looking up the payment
      if (!!err) {
        process.nextTick(() => emitter.emit('error', err));

        return emitter;
      }

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
        status: status || 'SUCCEEDED',
        value: '1',
        value_msat: '1000',
        value_sat: '1',
      }));

      return emitter;
    },
  };
};

const makeLnd = ({err, status}) => {
  return {
    default: makeLndDefault({}),
    router: makeLndRouter({err, status}),
    version: makeLndVersion({}),
  };
};

const makeArgs = overrides => {
  const calls = {quizzes: [], sent: []};

  const args = {
    calls,
    from: 'from',
    id: 1,
    invoice: makeInvoice({}),
    key: 'key',
    lnd: makeLnd({}),
    nodes: [],
    quiz: async ({answers, correct, question}) => {
      return calls.quizzes.push({
        question,
        answer: answers[correct],
        answers: answers.slice().sort(),
      });
    },
    send: async (id, message, options) => {
      return calls.sent.push({id, message, options});
    },
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
    args: makeArgs({nodes: undefined}),
    description: 'An array of nodes is required to post settled invoice',
    error: [400, 'ExpectedArrayOfNodesToPostSettledInvoice'],
  },
  {
    args: makeArgs({quiz: undefined}),
    description: 'Quiz is required to post settled invoice',
    error: [400, 'ExpectedSendQuizFunctionToPostSettledInvoice'],
  },
  {
    args: makeArgs({send: undefined}),
    description: 'Send is required to post settled invoice',
    error: [400, 'ExpectedSendFunctionToPostSettledInvoice'],
  },
  {
    args: makeArgs({}),
    description: 'A settled invoice is posted',
    expected: {
      quizzes: [],
      sent: [{
        id: 1,
        message: '☯️ Rebalanced 0\\.00000001 out 00000000 *→* 00000000\\. Fee: 0\\.00000001 100\\.00% \\(1000000\\)',
        options: {parse_mode: 'MarkdownV2'},
      }],
    },
  },
  {
    args: makeArgs({invoice: makeInvoice({is_confirmed: false})}),
    description: 'An unsettled invoice is not posted',
    expected: {quizzes: [], sent: []},
  },
  {
    args: makeArgs({lnd: makeLnd({status: 'FAILED'})}),
    description: 'A settled invoice is posted that has no payment',
    expected: {
      quizzes: [],
      sent: [{
        id: 1,
        message: '💵 Received 0\\.00000001 for “description” via 00000000000000000000000000000000 \\- Sender message: “message”',
        options: {parse_mode: 'MarkdownV2'},
      }],
    },
  },
  {
    args: makeArgs({lnd: makeLnd({err: 'err'})}),
    description: 'A settled invoice is posted which is not a rebalance',
    expected: {
      quizzes: [],
      sent: [{
        id: 1,
        message: '💵 Received 0\\.00000001 for “description” via 00000000000000000000000000000000 \\- Sender message: “message”',
        options: {parse_mode: 'MarkdownV2'},
      }],
    },
  },
  {
    args: makeArgs({min_rebalance_tokens: 2}),
    description: 'A rebalance under the minimum amount is not posted',
    expected: {quizzes: [], sent: []},
  },
  {
    args: makeArgs({min_rebalance_tokens: 1}),
    description: 'A rebalance of the minimum amount is posted',
    expected: {
      quizzes: [],
      sent: [{
        id: 1,
        message: '☯️ Rebalanced 0\\.00000001 out 00000000 *→* 00000000\\. Fee: 0\\.00000001 100\\.00% \\(1000000\\)',
        options: {parse_mode: 'MarkdownV2'},
      }],
    },
  },
  {
    args: makeArgs({
      lnd: {
        default: {getChanInfo: ({}, cbk) => cbk('err')},
        router: makeLndRouter({err: 'err'}),
        version: makeLndVersion({}),
      },
    }),
    description: 'The channel id is shown when the channel peer is not known',
    expected: {
      quizzes: [],
      sent: [{
        id: 1,
        message: '💵 Received 0\\.00000001 for “description” via 0x0x1 \\- Sender message: “message”',
        options: {parse_mode: 'MarkdownV2'},
      }],
    },
  },
  {
    args: makeArgs({
      nodes: [
        {lnd: makeLnd({}), public_key: 'other'},
        {lnd: makeLnd({}), public_key: 'key'},
      ],
    }),
    description: 'A transfer from another node is not posted',
    expected: {quizzes: [], sent: []},
  },
  {
    args: makeArgs({
      lnd: makeLnd({err: 'err'}),
      nodes: [{lnd: makeLnd({}), public_key: 'key'}],
    }),
    description: 'The receiving node is not named when it is the only node',
    expected: {
      quizzes: [],
      sent: [{
        id: 1,
        message: '💵 Received 0\\.00000001 for “description” via 00000000000000000000000000000000 \\- Sender message: “message”',
        options: {parse_mode: 'MarkdownV2'},
      }],
    },
  },
  {
    args: makeArgs({
      lnd: makeLnd({err: 'err'}),
      nodes: [
        {lnd: makeLnd({err: 'err'}), public_key: 'other'},
        {lnd: makeLnd({status: 'FAILED'}), public_key: 'another'},
        {lnd: makeLnd({}), public_key: 'key'},
      ],
    }),
    description: 'The receiving node is named when there are multiple nodes',
    expected: {
      quizzes: [],
      sent: [{
        id: 1,
        message: '💵 Received 0\\.00000001 for “description” via 00000000000000000000000000000000 \\- Sender message: “message” \\- from',
        options: {parse_mode: 'MarkdownV2'},
      }],
    },
  },
  {
    args: makeArgs({
      invoice: makeInvoice({
        is_push: true,
        payments: [{
          in_channel: '0x0x1',
          messages: [
            {type: '80501', value: Buffer.from(acceptRequest).toString('hex')},
            {type: '80502', value: '0f4240'},
            {type: '80504', value: '01'},
            {type: '80505', value: Buffer.alloc(33, 2).toString('hex')},
            {type: '80507', value: Buffer.alloc(32).toString('hex')},
            {type: '80508', value: '00'},
          ],
        }],
        received: 10,
        received_mtokens: '10000',
      }),
    }),
    description: 'A balanced channel open proposal is posted',
    expected: {
      quizzes: [],
      sent: [{
        id: 1,
        message: '⚖️ Received a 0\\.01000000 balanced channel open proposal from 031b84c5\n`031b84c5567b126440995d3ed5aaba0565d71e1834604819ff9c17f5e9d5dd078f`\nProposed chain fee rate: 1/vbyte',
        options: {parse_mode: 'MarkdownV2'},
      }],
    },
  },
  {
    args: makeArgs({
      invoice: makeInvoice({
        payments: [{
          in_channel: '0x0x1',
          messages: [
            {type: '34349334', value: Buffer.from('question').toString('hex')},
            {type: '80511', value: Buffer.from('c').toString('hex')},
            {type: '80509', value: Buffer.from('a').toString('hex')},
            {type: '80510', value: Buffer.from('b').toString('hex')},
          ],
        }],
      }),
      lnd: makeLnd({err: 'err'}),
    }),
    description: 'A quiz is posted after the received payment message',
    expected: {
      quizzes: [{answer: 'a', answers: ['a', 'b', 'c'], question: 'question'}],
      sent: [{
        id: 1,
        message: '💵 Received 0\\.00000001 for “description” via 00000000000000000000000000000000 \\- Sender message: “question”',
        options: {parse_mode: 'MarkdownV2'},
      }],
    },
  },
  {
    args: makeArgs({
      invoice: makeInvoice({
        payments: [{
          in_channel: '0x0x1',
          messages: [
            {type: '34349334', value: Buffer.from('question').toString('hex')},
            {type: '80509', value: Buffer.from('a').toString('hex')},
          ],
        }],
      }),
      lnd: makeLnd({err: 'err'}),
    }),
    description: 'A quiz with only one answer is not posted',
    expected: {
      quizzes: [],
      sent: [{
        id: 1,
        message: '💵 Received 0\\.00000001 for “description” via 00000000000000000000000000000000 \\- Sender message: “question”',
        options: {parse_mode: 'MarkdownV2'},
      }],
    },
  },
  {
    args: makeArgs({
      invoice: makeInvoice({
        payments: [{
          in_channel: '0x0x1',
          messages: [
            {type: '34349334', value: Buffer.from('question').toString('hex')},
            {type: '80509', value: Buffer.from('a').toString('hex')},
            {type: '80510', value: Buffer.from('b').toString('hex')},
          ],
        }],
      }),
      lnd: makeLnd({err: 'err'}),
    }),
    description: 'A quiz with the minimum number of answers is posted',
    expected: {
      quizzes: [{answer: 'a', answers: ['a', 'b'], question: 'question'}],
      sent: [{
        id: 1,
        message: '💵 Received 0\\.00000001 for “description” via 00000000000000000000000000000000 \\- Sender message: “question”',
        options: {parse_mode: 'MarkdownV2'},
      }],
    },
  },
  {
    args: makeArgs({
      invoice: makeInvoice({
        payments: [{
          in_channel: '0x0x1',
          messages: [
            {type: '34349334', value: Buffer.from('question').toString('hex')},
            ...'abcdefghij'.split('').map((answer, index) => ({
              type: String(80509 + index),
              value: Buffer.from(answer).toString('hex'),
            })),
          ],
        }],
      }),
      lnd: makeLnd({err: 'err'}),
    }),
    description: 'A quiz with the maximum number of answers is posted',
    expected: {
      quizzes: [{
        answer: 'a',
        answers: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'],
        question: 'question',
      }],
      sent: [{
        id: 1,
        message: '💵 Received 0\\.00000001 for “description” via 00000000000000000000000000000000 \\- Sender message: “question”',
        options: {parse_mode: 'MarkdownV2'},
      }],
    },
  },
  {
    args: makeArgs({
      invoice: makeInvoice({
        payments: [{
          in_channel: '0x0x1',
          messages: [
            {type: '34349334', value: Buffer.from('question').toString('hex')},
            ...[...Array(11)].map(() => ({
              type: '80509',
              value: Buffer.from('a').toString('hex'),
            })),
          ],
        }],
      }),
      lnd: makeLnd({err: 'err'}),
    }),
    description: 'A quiz with too many answers is not posted',
    expected: {
      quizzes: [],
      sent: [{
        id: 1,
        message: '💵 Received 0\\.00000001 for “description” via 00000000000000000000000000000000 \\- Sender message: “question”',
        options: {parse_mode: 'MarkdownV2'},
      }],
    },
  },
];

tests.forEach(({args, description, error, expected}) => {
  return test(description, async () => {
    if (!!error) {
      await rejects(postSettledInvoice(args), error, 'Got expected error');
    } else {
      await postSettledInvoice(args);

      deepEqual(args.calls, expected, 'Got expected result');
    }

    return;
  });
});
