const {test} = require('tap');

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
    reply: message => {
      const expected = [
        '⏳ from:\n' +
        'Waiting for inbound 3 channel with a 02020202 to confirm: 0000000000000000000000000000000000000000000000000000000000000000\n' +
        'Waiting to recover 1 in an hour from closing channel with a 02020202',

        '💸 from:\n' +
        'Forwarding 1 for 1 fee from a 02020202 to b 03030303\n' +
        'Probing out a 02020202',
      ];

      if (!expected.includes(message)) {
        throw new Error('ReceivedUnexpectedMessageForPendingNotification');
      }
    },
  };

  Object.keys(overrides).forEach(k => args[k] = overrides[k]);

  return args;
};

const tests = [
  {
    args: makeArgs({}),
    description: 'Notify of pending payments and channels',
  },
];

tests.forEach(({args, description, error, expected}) => {
  return test(description, async ({end, rejects}) => {
    if (!!error) {
      throws(() => notifyOfPending(args), error, 'Got expected error');
    } else {
      notifyOfPending(args);
    }

    return end();
  });
});
