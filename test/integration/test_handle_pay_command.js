const {deepEqual} = require('node:assert').strict;
const test = require('node:test');

const asyncRetry = require('async/retry');
const {cancelHodlInvoice} = require('lightning');
const {createInvoice} = require('lightning');
const {getNode} = require('lightning');
const {setupChannel} = require('ln-docker-daemons');
const {spawnLightningCluster} = require('ln-docker-daemons');

const {handlePayCommand} = require('./../../');

const budget = 1e4;
const interval = 10;
const size = 2;
const times = 10000;
const tokens = 100;

// Paying with the pay command should send payments and report rejections
test(`Handle pay command`, async () => {
  const {kill, nodes} = await spawnLightningCluster({size});

  const [{generate, id, lnd}, target] = nodes;

  // Pay a payment request with the pay command and return the replies
  const pay = async ({request}) => {
    const replies = [];

    await handlePayCommand({
      budget,
      from: 1,
      id: 1,
      nodes: [{lnd, from: 'from', public_key: id}],
      reply: async message => replies.push(message),
      text: `/pay ${request}`,
    });

    return replies;
  };

  try {
    await setupChannel({generate, lnd, to: target});

    // Wait for target graph announcement
    await asyncRetry({interval, times}, async () => {
      if (!(await getNode({lnd, public_key: target.id})).alias) {
        throw new Error('ExpectedNodeAliasFoundInGraph');
      }
    });

    // A payment that goes through is reported as sent
    const paid = await createInvoice({tokens, lnd: target.lnd});

    deepEqual(
      await pay({request: paid.request}),
      [`🤖 Paying ${tokens}...`, `Sent ${tokens}! Fee: 0.`],
      'Payment is sent'
    );

    // A payment to a canceled invoice is rejected by the receiver
    const rejected = await createInvoice({tokens, lnd: target.lnd});

    await cancelHodlInvoice({id: rejected.id, lnd: target.lnd});

    deepEqual(
      await pay({request: rejected.request}),
      [
        `🤖 Paying ${tokens}...`,
        'The receiver rejected the payment. Try again?',
      ],
      'A rejected payment is reported'
    );
  } catch (err) {
    deepEqual(err, null, 'Expected no error');
  }

  await kill({});

  return;
});
