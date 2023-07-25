const {rejects} = require('node:assert').strict;
const test = require('node:test');

const {handleEarningsCommand} = require('./../../');

const tests = [
  {
    args: {},
    description: 'Earnings command requires from id',
    error: [400, 'ExpectedFromUserIdNumberForEarningsCommand'],
  },
  {
    args: {
      from: 1,
      id: 1,
      nodes: [{
        from: 'node',
        lnd: {
          default: {
            forwardingHistory: ({}, cbk) => cbk(null, {
              forwarding_events: [{
                amt_in: '2',
                amt_in_msat: '2000',
                amt_out: '1',
                amt_out_msat: '1000',
                chan_id_in: '1',
                chan_id_out: '2',
                fee: '1',
                fee_msat: '1000',
                timestamp: '1',
                timestamp_ns: '1000000',
              }],
              last_offset_index: '1',
            }),
            listInvoices: ({}, cbk) => {
              return cbk(null, {
                first_index_offset: '1',
                invoices: [],
                last_index_offset: '1',
              });
            },
          },
        },
        public_key: Buffer.alloc(33).toString('hex'),
      }],
      reply: () => {},
      text: '/earnings',
      working: () => {},
    },
    description: 'Earnings command is handled',
    expected: {},
  },
];

tests.forEach(({args, description, error, expected}) => {
  return test(description, async () => {
    if (!!error) {
      await rejects(handleEarningsCommand(args), error, 'Got expected error');
    } else {
      await handleEarningsCommand(args);
    }

    return;
  });
});
