const {createHash} = require('node:crypto');
const {deepEqual} = require('node:assert').strict;
const {randomBytes} = require('node:crypto');
const test = require('node:test');

const asyncRetry = require('async/retry');
const {getNode} = require('ln-service');
const {payViaPaymentDetails} = require('ln-service');
const {setupChannel} = require('ln-docker-daemons');
const {signBytes} = require('ln-service');
const {spawnLightningCluster} = require('ln-docker-daemons');
const {subscribeToInvoices} = require('ln-service');

const {postSettledInvoice} = require('./../../');

const dateType = '34349343';
const from = 'control';
const fromKeyType = '34349339';
const hexOf = text => Buffer.from(text).toString('hex');
const id = 1;
const interval = 10;
const keySendType = '5482373484';
const message = 'Hello from an integration test';
const messageType = '34349334';
const nodeKeyFamily = 6;
const nodeKeyIndex = 0;
const quiz = () => {};
const sha256 = n => createHash('sha256').update(n).digest().toString('hex');
const signatureType = '34349337';
const size = 2;
const times = 10000;
const tokens = 100;

// Receiving a payment with a message should post the message and its sender
test(`Post settled invoice`, async () => {
  const {kill, nodes} = await spawnLightningCluster({size});

  const [control, target] = nodes;

  const invoices = [];
  const sub = subscribeToInvoices({lnd: control.lnd});

  sub.on('invoice_updated', invoice => invoices.push(invoice));
  sub.on('error', () => {});

  // Wait for a node to show up with an alias in the graph of another node
  const aliasOf = async ({key, lnd}) => {
    return await asyncRetry({interval, times}, async () => {
      const {alias} = await getNode({lnd, public_key: key});

      if (!alias) {
        throw new Error('ExpectedNodeAliasFoundInGraph');
      }

      return alias;
    });
  };

  // Keysend to the control node and return the received payment messages
  const receive = async ({messages}) => {
    const posted = [];
    const preimage = randomBytes(32);

    const paymentHash = sha256(preimage);

    await payViaPaymentDetails({
      tokens,
      destination: control.id,
      id: paymentHash,
      lnd: target.lnd,
      messages: [{type: keySendType, value: preimage.toString('hex')}]
        .concat(messages),
    });

    // Wait for the control node to see the payment received
    const invoice = await asyncRetry({interval, times}, async () => {
      const paid = invoices.find(n => n.id === paymentHash && n.is_confirmed);

      if (!paid) {
        throw new Error('ExpectedReceivedPaymentInvoice');
      }

      return paid;
    });

    await postSettledInvoice({
      from,
      id,
      invoice,
      quiz,
      key: control.id,
      lnd: control.lnd,
      nodes: [{from, lnd: control.lnd, public_key: control.id}],
      send: async (user, text) => posted.push(text),
    });

    return posted;
  };

  try {
    // The target opens a channel to the control node so it can pay it
    await setupChannel({
      generate: target.generate,
      lnd: target.lnd,
      to: control,
    });

    // The target needs the control node in its graph to pay it
    await aliasOf({key: control.id, lnd: target.lnd});

    const alias = await aliasOf({key: target.id, lnd: control.lnd});

    const date = hexOf(new Date().toISOString());
    const received = `💵 Received 0\\.00000100 via ${alias}`;
    const said = `Sender message: “${message}”`;

    // The sender signs the sender, receiver, date and message together
    const {signature} = await signBytes({
      key_family: nodeKeyFamily,
      key_index: nodeKeyIndex,
      lnd: target.lnd,
      preimage: [target.id, control.id, date, hexOf(message)].join(''),
    });

    // A signed message is posted with who sent it
    const signed = await receive({
      messages: [
        {type: messageType, value: hexOf(message)},
        {type: fromKeyType, value: target.id},
        {type: dateType, value: date},
        {type: signatureType, value: signature},
      ],
    });

    deepEqual(
      signed,
      [[received, said, `From: ${alias}`].join(' \\- ')],
      'Signed message is posted with the sender'
    );

    // A message that is not signed is posted with an unverified sender
    const unsigned = await receive({
      messages: [
        {type: messageType, value: hexOf(message)},
        {type: fromKeyType, value: target.id},
      ],
    });

    const unverified = `Marked as from: ${alias} \\(unverified/unsigned\\)`;

    deepEqual(
      unsigned,
      [[received, said, unverified].join(' \\- ')],
      'Unsigned message is posted with an unverified sender'
    );
  } catch (err) {
    deepEqual(err, null, 'Expected no error');
  } finally {
    sub.removeAllListeners();

    await kill({});
  }

  return;
});
