const {deepEqual} = require('node:assert').strict;
const {rejects} = require('node:assert').strict;
const test = require('node:test');

const decodeCommand = require('./../../commands/decode_command');

const help = {
  select_node_text: 'Node to pay with?',
  syntax_example_text: '/pay <payment request> \\[max payment amount]',
};
const nodes = [
  {from: 'node1', lnd: {id: 'lnd1'}},
  {from: 'node2', lnd: {id: 'lnd2'}},
];

const makeArgs = overrides => {
  const calls = {replies: []};

  const args = {
    calls,
    help,
    nodes: nodes.slice(0, 1),
    reply: text => calls.replies.push(text.split('\n')),
    text: '/pay request 100',
  };

  Object.keys(overrides).forEach(k => args[k] = overrides[k]);

  return args;
};

const tests = [
  {
    args: makeArgs({help: undefined}),
    description: 'Help text is expected',
    error: [400, 'ExpectedHelpTextToDecodeCommand'],
    expected: {replies: []},
  },
  {
    args: makeArgs({nodes: undefined}),
    description: 'An array of nodes is expected',
    error: [400, 'ExpectedNodesWhenDecodingCommand'],
    expected: {replies: []},
  },
  {
    args: makeArgs({reply: undefined}),
    description: 'A reply function is expected',
    error: [400, 'ExpectedReplyFunctionToDecodeCommand'],
    expected: {replies: []},
  },
  {
    args: makeArgs({text: undefined}),
    description: 'The command text is expected',
    error: [400, 'ExpectedCommandTextToDecodeCommand'],
    expected: {replies: []},
  },
  {
    args: makeArgs({}),
    description: 'A command for a single node is decoded',
    expected: {
      decoded: {lnd: {id: 'lnd1'}, params: ['request', '100']},
      replies: [],
    },
  },
  {
    args: makeArgs({nodes, text: '/pay 2 request 100'}),
    description: 'A command for a selected node is decoded',
    expected: {
      decoded: {lnd: {id: 'lnd2'}, params: ['request', '100']},
      replies: [],
    },
  },
  {
    args: makeArgs({nodes, text: '/pay'}),
    description: 'A node must be selected when there are multiple nodes',
    error: [400, 'UnknownNodeToUseForCommand'],
    expected: {
      replies: [[
        'Node to pay with?',
        '- 1: node1',
        '- 2: node2',
        '/pay <node #> <payment request> \\[max payment amount]',
      ]],
    },
  },
  {
    args: makeArgs({nodes, text: '/pay 3 request 100'}),
    description: 'A selected node must be a known node',
    error: [400, 'UnknownNodeToUseForCommand'],
    expected: {
      replies: [[
        'Node to pay with?',
        '- 1: node1',
        '- 2: node2',
        '/pay <node #> <payment request> \\[max payment amount]',
      ]],
    },
  },
];

tests.forEach(({args, description, error, expected}) => {
  return test(description, async () => {
    if (!!error) {
      await rejects(decodeCommand(args), error, 'Got expected error');
    } else {
      const res = await decodeCommand(args);

      deepEqual(res, expected.decoded, 'Got expected result');
    }

    deepEqual(args.calls.replies, expected.replies, 'Got expected replies');

    return;
  });
});
