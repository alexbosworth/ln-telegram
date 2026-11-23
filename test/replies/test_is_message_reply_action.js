const {equal} = require('node:assert').strict;
const test = require('node:test');

const {isMessageReplyAction} = require('./../../replies');
const {key} = require('./../fixtures/encoded');
const {request} = require('./../fixtures/encoded');
const {nodeTrade: trade} = require('./../fixtures/encoded');

const join = lines => lines.join('\n');

// The bot is user 2
const makeCtx = ({me = {id: 2}, reply}) => {
  return {me, update: {message: {reply_to_message: reply, text: 'text'}}};
};

const makeQuestion = ({from}) => {
  return {
    from,
    text: join([
      'Invoice: 0.00000001 “description”',
      request,
      '',
      'What is this invoice for?',
    ]),
  };
};

const makeArgs = overrides => {
  const args = {
    ctx: makeCtx({reply: makeQuestion({from: {id: 2}})}),
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
          from: {id: 2},
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
    args: makeArgs({ctx: makeCtx({reply: {from: {id: 2}}})}),
    description: 'A reply to a message without text is not a reply action',
    expected: false,
  },
  {
    args: makeArgs({ctx: makeCtx({reply: {from: {id: 2}, text: 'text'}})}),
    description: 'A reply to a message that is not a question is not an action',
    expected: false,
  },
  {
    args: makeArgs({ctx: makeCtx({reply: makeQuestion({from: {id: 3}})})}),
    description: 'A reply to a question the bot did not post is not an action',
    expected: false,
  },
  {
    args: makeArgs({ctx: makeCtx({reply: makeQuestion({})})}),
    description: 'A reply to a question with no sender is not a reply action',
    expected: false,
  },
  {
    args: makeArgs({
      ctx: makeCtx({me: null, reply: makeQuestion({from: {id: 2}})}),
    }),
    description: 'A reply is not a reply action when the bot is not known',
    expected: false,
  },
];

tests.forEach(({args, description, expected}) => {
  return test(description, (context, end) => {
    equal(isMessageReplyAction(args), expected, 'Got expected result');

    return end();
  });
});
