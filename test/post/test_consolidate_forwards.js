const {test} = require('@alexbosworth/tap');

const method = require('./../../post/consolidate_forwards');

const tests = [
  {
    args: {
      forwards: [
        {
          fee: 1,
          incoming_channel: '0x0x0',
          outgoing_channel: '1x1x1',
          tokens: 1,
        },
        {
          fee: 1,
          incoming_channel: '0x0x0',
          outgoing_channel: '1x1x1',
          tokens: 1,
        },
      ],
    },
    description: 'Forwards are consolidated',
    expected: {
      forwards: [{
        fee: 2,
        incoming_channel: '0x0x0',
        outgoing_channel: '1x1x1',
        tokens: 2,
      }],
    },
  },
];

tests.forEach(({args, description, error, expected}) => {
  return test(description, async ({end, rejects, strictSame}) => {
    const res = method(args);

    strictSame(res, expected, 'Got expected result');

    return end();
  });
});
