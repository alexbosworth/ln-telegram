const {test} = require('tap');

const {listChannelsResponse} = require('./../fixtures');
const {getInfoResponse} = require('./../fixtures');
const {getNodeInfoResponse} = require('./../fixtures');
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
    args: makeArgs({}),
    description: 'Got received message for a received invoice',
    expected: {
      message:  'Received 1 for “description”\nSender message: “message”',
    },
  },
  {
    args: makeArgs({payments: [{messages: []}]}),
    description: 'Got received message for a received invoice',
    expected: {
      message:  'Received 1 for “description”',
    },
  },
  {
    args: makeArgs({payments: []}),
    description: 'Got received message for a received invoice with message',
    expected: {
      message:  'Received 1 for “description”',
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
      message: 'Received 1 for “description”\n' +
        'Sender message: “message”\n' +
        'Marked as from: 000000000000000000000000000000000000000000000000000000000000000000 (unverified/unsigned)',
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
      message: 'Received 1 for “description”\nSender message: “message”',
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
      message: 'Received 1 for “description”\n' +
        'Sender message: “message”\n' +
        'From: 000000000000000000000000000000000000000000000000000000000000000000',
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
      message: 'Received 1 for “description”\n' +
        'Sender message: “message”\n' +
        'Marked as from: 000000000000000000000000000000000000000000000000000000000000000000 (unverified/unsigned)',
    },
  },
];

tests.forEach(({args, description, error, expected}) => {
  return test(description, async ({end, equal, rejects}) => {
    if (!!error) {
      await rejects(getReceivedMessage(args), error, 'Got expected error');
    } else {
      const {message} = await getReceivedMessage(args);

      equal(message, expected.message, 'Got expected message');
    }

    return end();
  });
});
