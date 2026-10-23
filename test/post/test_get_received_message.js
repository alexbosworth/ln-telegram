const {deepEqual} = require('node:assert').strict;
const {rejects} = require('node:assert').strict;
const test = require('node:test');

const {getInfoResponse} = require('./../fixtures');
const {getNodeInfoResponse} = require('./../fixtures');
const {nodeInfoResult} = require('./../fixtures');
const getReceivedMessage = require('./../../post/get_received_message');

const getInfoRes = () => JSON.parse(JSON.stringify(getInfoResponse));

const makeArgs = overrides => {
  const args = {
    description: 'description',
    lnd: {
      default: {
        getInfo: ({}, cbk) => cbk(null, getInfoRes()),
        getNodeInfo: ({}, cbk) => cbk(null, getNodeInfoResponse),
      },
      signer: {
        verifyMessage: ({}, cbk) => cbk(null, {valid: true}),
      },
    },
    payments: [{
      messages: [{
        type: '34349334',
        value: Buffer.from('message').toString('hex'),
      }],
    }],
    received: 1,
    via: [{
      alias: '',
      id: 'x',
    }],
  };

  Object.keys(overrides).forEach(k => args[k] = overrides[k]);

  return args;
};

const tests = [
  {
    args: makeArgs({description: undefined}),
    description: 'Expects invoice description',
    error: [400, 'ExpectedInvoiceDescriptionToGetReceiveMessage'],
  },
  {
    args: makeArgs({lnd: undefined}),
    description: 'Expects lnd',
    error: [400, 'ExpectedAuthenticatedLndToGetReceiveMessage'],
  },
  {
    args: makeArgs({payments: undefined}),
    description: 'Expects payments',
    error: [400, 'ExpectedArrayOfReceivePaymentsForReceiveMessage'],
  },
  {
    args: makeArgs({via: undefined}),
    description: 'Expects via nodes',
    error: [400, 'ExpectedArrayOfViaNodesForReceiveMessage'],
  },
  {
    args: makeArgs({}),
    description: 'Got received message for a received invoice',
    expected: {
      icon: '💵',
      message: 'Received 0\\.00000001 for “description” via x \\- Sender message: “message”',
      quiz: [],
      title: 'message',
    },
  },
  {
    args: makeArgs({description: ''}),
    description: 'Got received message for a received invoice with no desc',
    expected: {
      icon: '💵',
      message: 'Received 0\\.00000001 via x \\- Sender message: “message”',
      quiz: [],
      title: 'message',
    },
  },
  {
    args: makeArgs({payments: [{messages: []}]}),
    description: 'Got received message for a received invoice',
    expected: {
      icon: '💵',
      message: 'Received 0\\.00000001 for “description” via x',
    },
  },
  {
    args: makeArgs({payments: []}),
    description: 'Got received message for a received invoice with message',
    expected: {
      icon: '💵',
      message: 'Received 0\\.00000001 for “description” via x',
    },
  },
  {
    args: makeArgs({
      payments: [{
        messages: [
          {
            type: '34349334',
            value: Buffer.from('message').toString('hex'),
          },
          {
            type: '34349339',
            value: Buffer.alloc(33).toString('hex'),
          },
        ],
      }],
    }),
    description: 'Got received message with a from key and message',
    expected: {
      icon: '💵',
      message: 'Received 0\\.00000001 for “description” via x \\- Sender message: “message” \\- Marked as from: 000000000000000000000000000000000000000000000000000000000000000000 \\(unverified/unsigned\\)',
      quiz: [],
      title: 'message',
    },
  },
  {
    args: makeArgs({
      payments: [{
        messages: [
          {
            type: '34349334',
            value: Buffer.from('message').toString('hex'),
          },
          {
            type: '34349337',
            value: Buffer.alloc(1).toString('hex'),
          },
        ],
      }],
    }),
    description: 'Got received message with a from key and signed message',
    expected: {
      icon: '💵',
      message: 'Received 0\\.00000001 for “description” via x \\- Sender message: “message”',
      quiz: [],
      title: 'message',
    },
  },
  {
    args: makeArgs({
      payments: [{
        messages: [
          {
            type: '34349334',
            value: Buffer.from('message').toString('hex'),
          },
          {
            type: '34349339',
            value: Buffer.alloc(33).toString('hex'),
          },
          {
            type: '34349343',
            value: Buffer.alloc(1).toString('hex'),
          },
          {
            type: '34349337',
            value: Buffer.alloc(1).toString('hex'),
          },
        ],
      }],
    }),
    description: 'Got received message with a from key and signed message',
    expected: {
      icon: '💵',
      message: 'Received 0\\.00000001 for “description” via x \\- Sender message: “message” \\- From: 000000000000000000000000000000000000000000000000000000000000000000',
      quiz: [],
      title: 'message',
    },
  },
  {
    args: makeArgs({
      lnd: {
        default: {
          getInfo: ({}, cbk) => cbk(null, getInfoRes()),
          getNodeInfo: ({}, cbk) => cbk(null, getNodeInfoResponse),
        },
        signer: {
          verifyMessage: ({}, cbk) => cbk('err'),
        },
      },
      payments: [{
        messages: [
          {
            type: '34349334',
            value: Buffer.from('message').toString('hex'),
          },
          {
            type: '34349339',
            value: Buffer.alloc(33).toString('hex'),
          },
          {
            type: '34349343',
            value: Buffer.alloc(1).toString('hex'),
          },
          {
            type: '34349337',
            value: Buffer.alloc(1).toString('hex'),
          },
        ],
      }],
    }),
    description: 'Got received message with a from key and signed message',
    expected: {
      icon: '💵',
      message: 'Received 0\\.00000001 for “description” via x \\- Sender message: “message” \\- Marked as from: 000000000000000000000000000000000000000000000000000000000000000000 \\(unverified/unsigned\\)',
      quiz: [],
      title: 'message',
    },
  },
  {
    args: makeArgs({via: [{alias: 'alias', id: 'x'}, {alias: '', id: 'y'}]}),
    description: 'Got received message via multiple peers',
    expected: {
      icon: '💵',
      message: 'Received 0\\.00000001 for “description” via alias, y \\- Sender message: “message”',
      quiz: [],
      title: 'message',
    },
  },
  {
    args: makeArgs({
      lnd: {
        default: {
          getInfo: ({}, cbk) => cbk(null, getInfoRes()),
          getNodeInfo: ({}, cbk) => cbk(null, nodeInfoResult),
        },
        signer: {
          verifyMessage: ({}, cbk) => cbk(null, {valid: true}),
        },
      },
      payments: [{
        messages: [
          {
            type: '34349334',
            value: Buffer.from('message').toString('hex'),
          },
          {
            type: '34349339',
            value: Buffer.alloc(33).toString('hex'),
          },
        ],
      }],
    }),
    description: 'Got received message with a from key that has an alias',
    expected: {
      icon: '💵',
      message: 'Received 0\\.00000001 for “description” via x \\- Sender message: “message” \\- Marked as from: alias \\(unverified/unsigned\\)',
      quiz: [],
      title: 'message',
    },
  },
  {
    args: makeArgs({
      lnd: {
        default: {
          getInfo: ({}, cbk) => cbk(null, getInfoRes()),
          getNodeInfo: ({}, cbk) => cbk(null, getNodeInfoResponse),
        },
        signer: {
          verifyMessage: ({}, cbk) => cbk(null, {valid: false}),
        },
      },
      payments: [{
        messages: [
          {
            type: '34349334',
            value: Buffer.from('message').toString('hex'),
          },
          {
            type: '34349339',
            value: Buffer.alloc(33).toString('hex'),
          },
          {
            type: '34349343',
            value: Buffer.alloc(1).toString('hex'),
          },
          {
            type: '34349337',
            value: Buffer.alloc(1).toString('hex'),
          },
        ],
      }],
    }),
    description: 'Got received message with a from key and invalid signature',
    expected: {
      icon: '💵',
      message: 'Received 0\\.00000001 for “description” via x \\- Sender message: “message” \\- Marked as from: 000000000000000000000000000000000000000000000000000000000000000000 \\(unverified/unsigned\\)',
      quiz: [],
      title: 'message',
    },
  },
  {
    args: makeArgs({
      payments: [{
        messages: [
          {
            type: '34349334',
            value: Buffer.from('question').toString('hex'),
          },
          {
            type: '80508',
            value: Buffer.from('below').toString('hex'),
          },
          {
            type: '80518',
            value: Buffer.from('c').toString('hex'),
          },
          {
            type: '80509',
            value: Buffer.from('a').toString('hex'),
          },
          {
            type: '80519',
            value: Buffer.from('above').toString('hex'),
          },
          {
            type: '80510',
            value: Buffer.from('b').toString('hex'),
          },
        ],
      }],
    }),
    description: 'Got received message with quiz answers',
    expected: {
      icon: '💵',
      message: 'Received 0\\.00000001 for “description” via x \\- Sender message: “question”',
      quiz: ['a', 'b', 'c'],
      title: 'question',
    },
  },
];

tests.forEach(({args, description, error, expected}) => {
  return test(description, async () => {
    if (!!error) {
      await rejects(getReceivedMessage(args), error, 'Got expected error');
    } else {
      const res = await getReceivedMessage(args);

      deepEqual(res, expected, 'Got expected result');
    }

    return;
  });
});
