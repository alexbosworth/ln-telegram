const {test} = require('@alexbosworth/tap');

const notifyOfPending = require('./../../commands/notify_of_pending');

const makeArgs = overrides => {
  const args = {
    htlcs: [{
      forwarding: [{
        fee: 1,
        in_peer: Buffer.alloc(33, 2).toString('hex'),
        out_peer: Buffer.alloc(33, 3).toString('hex'),
        tokens: 1,
      }],
      from: 'from',
      nodes: [
        {
          alias: 'a',
          id: Buffer.alloc(33, 2).toString('hex'),
        },
        {
          alias: 'b',
          id: Buffer.alloc(33, 3).toString('hex'),
        },
      ],
      sending: [{
        out_peer: Buffer.alloc(33, 2).toString('hex'),
      }],
    }],
    pending: [{
      closing: [{
        partner_public_key: Buffer.alloc(33, 2).toString('hex'),
        pending_balance: 1,
        timelock_expiration: 10,
      }],
      from: 'from',
      height: 5,
      nodes: [{
        alias: 'a',
        id: Buffer.alloc(33, 2).toString('hex'),
      }],
      opening: [{
        is_partner_initiated: true,
        local_balance: 1,
        partner_public_key: Buffer.alloc(33, 2).toString('hex'),
        remote_balance: 1,
        transaction_fee: 1,
        transaction_id: Buffer.alloc(32).toString('hex'),
      }],
    }],
  };

  Object.keys(overrides).forEach(k => args[k] = overrides[k]);

  return args;
};

const tests = [
  {
    args: makeArgs({}),
    description: 'Notify of pending payments and channels',
    expected: [
      `⏳ from:
Waiting for inbound 3 channel with a 02020202 to confirm: 0000000000000000000000000000000000000000000000000000000000000000
Waiting to recover 1 in 49 minutes from closing channel with a 02020202`,
      `💸 from:
Forwarding 1 for 1 fee from a 02020202 to b 03030303
Probing out a 02020202`,
    ],
  },
];

tests.forEach(({args, description, error, expected}) => {
  return test(description, async ({end, equal, rejects}) => {
    if (!!error) {
      throws(() => notifyOfPending(args), error, 'Got expected error');
    } else {
      notifyOfPending(Object.assign(args, {
        reply: message => {
          equal(message, expected.shift());
        }
      }));
    }

    return end();
  });
});
