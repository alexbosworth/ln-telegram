const {deepEqual} = require('node:assert').strict;
const {InlineKeyboard} = require('grammy');
const test = require('node:test');

const {tradeEditButtons} = require('./../../messages');

const tests = [
  {
    args: {nodes: [{
      from: 'node1',
      public_key: Buffer.alloc(33, 2).toString('hex'),
    }]},
    description: 'Trade edit buttons are mapped',
    expected: {
      markup: new InlineKeyboard()
        .text('Set Description', 'set-trade-description')
        .text('Expiry...', 'set-trade-expires-at')
        .text('🗑', 'cancel-trade'),
    },
  },
  {
    args: {
      nodes: [
        {
          from: 'node1',
          public_key: Buffer.alloc(33, 2).toString('hex'),
        },
        {
          from: 'node2',
          public_key: Buffer.alloc(33, 3).toString('hex'),
        },
      ],
    },
    description: 'A node button is added when there are multiple nodes',
    expected: {
      markup: new InlineKeyboard()
        .text('Set Description', 'set-trade-description')
        .text('Expiry...', 'set-trade-expires-at')
        .text('Node...', 'set-trade-node')
        .text('🗑', 'cancel-trade'),
    },
  },
  {
    args: {
      is_selecting: true,
      nodes: [
        {
          from: 'node1',
          public_key: Buffer.alloc(33, 2).toString('hex'),
        },
        {
          from: 'node2',
          public_key: Buffer.alloc(33, 3).toString('hex'),
        },
      ],
    },
    description: 'A button for each node is shown when selecting a node',
    expected: {
      markup: new InlineKeyboard()
        .text('Set Description', 'set-trade-description')
        .text('Expiry...', 'set-trade-expires-at')
        .text('🗑', 'cancel-trade')
        .row()
        .text(
          'Node: node1',
          'switch-trade-to-0202020202020202020202020202020202020202020202'
        )
        .row()
        .text(
          'Node: node2',
          'switch-trade-to-0303030303030303030303030303030303030303030303'
        ),
    },
  },
];

tests.forEach(({args, description, expected}) => {
  return test(description, (context, end) => {
    deepEqual(tradeEditButtons(args), expected, 'Got expected result');

    return end();
  });
});
