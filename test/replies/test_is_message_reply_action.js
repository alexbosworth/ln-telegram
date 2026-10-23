const {equal} = require('node:assert').strict;
const test = require('node:test');

const {isMessageReplyAction} = require('./../../replies');
const {key} = require('./../fixtures/encoded');
const {request} = require('./../fixtures/encoded');
const {nodeTrade: trade} = require('./../fixtures/encoded');

const join = lines => lines.join('\n');

const makeCtx = ({reply}) => {
  return {update: {message: {reply_to_message: reply, text: 'text'}}};
};

const makeArgs = overrides => {
  const args = {
    ctx: makeCtx({
      reply: {
        text: join([
          'Invoice: 0.00000001 “description”',
          request,
          '',
          'What is this invoice for?',
        ]),
      },
    }),
    nodes: [{public_key: key}],
  };

  Object.keys(overrides).forEach(k => args[k] = overrides[k]);

  return args;
};

const tests = [
  {
    args: makeArgs({}),
    description: 'A reply to an invoice question is a reply action',
    expected: true,
  },
  {
    args: makeArgs({
      ctx: makeCtx({
        reply: {
          text: join([
            'Trade-Secret: 0.00000001 “description” expires 1/1/2100',
            trade,
            '',
            'What are you selling?',
          ]),
        },
      }),
    }),
    description: 'A reply to a trade question is a reply action',
    expected: true,
  },
  {
    args: makeArgs({ctx: undefined}),
    description: 'A missing context is not a reply action',
    expected: false,
  },
  {
    args: makeArgs({ctx: {}}),
    description: 'A context without an update is not a reply action',
    expected: false,
  },
  {
    args: makeArgs({ctx: {update: {}}}),
    description: 'An update without a message is not a reply action',
    expected: false,
  },
  {
    args: makeArgs({ctx: makeCtx({})}),
    description: 'A message that is not a reply is not a reply action',
    expected: false,
  },
  {
    args: makeArgs({ctx: makeCtx({reply: {}})}),
    description: 'A reply to a message without text is not a reply action',
    expected: false,
  },
  {
    args: makeArgs({ctx: makeCtx({reply: {text: 'text'}})}),
    description: 'A reply to a message that is not a question is not an action',
    expected: false,
  },
];

tests.forEach(({args, description, expected}) => {
  return test(description, (context, end) => {
    equal(isMessageReplyAction(args), expected, 'Got expected result');

    return end();
  });
});
