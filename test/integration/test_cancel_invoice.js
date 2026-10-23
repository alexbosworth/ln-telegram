const {deepEqual} = require('node:assert').strict;
const {rejects} = require('node:assert').strict;
const test = require('node:test');

const asyncRetry = require('async/retry');
const {getInvoice} = require('ln-service');
const {getNode} = require('ln-service');
const {parsePaymentRequest} = require('ln-service');
const {payViaPaymentRequest} = require('ln-service');
const {setupChannel} = require('ln-docker-daemons');
const {spawnLightningCluster} = require('ln-docker-daemons');

const {callbackCommands} = require('./../../interface');
const {handleButtonPush} = require('./../../');
const {handleInvoiceCommand} = require('./../../');

const asText = markdown => markdown.replace(/`/g, '').replace(/\\(.)/g, '$1');
const bot = {};
const flatten = arr => [].concat(...arr);
const id = 1;
const interval = 10;
const match = '100 integration test';
const request = ({}, cbk) => cbk([500, 'ExpectedNoFiatPriceRequest']);
const size = 2;
const times = 10000;

// Pushing the cancel button on an invoice should stop it from being paid
test(`Cancel invoice`, async () => {
  const {kill, nodes} = await spawnLightningCluster({size});

  const [control, target] = nodes;

  const saved = [{from: 'control', lnd: control.lnd, public_key: control.id}];

  // Create an invoice with the invoice command and return the posted message
  const createInvoice = async () => {
    const posted = [];

    await handleInvoiceCommand({
      id,
      request,
      ctx: {
        match,
        deleteMessage: async () => {},
        message: {from: {id}},
        reply: async (text, options) => posted.push({options, text}),
      },
      nodes: saved,
    });

    const [message] = posted;

    // Telegram shows the message as plain text, with the request on line 2
    const [, invoice] = asText(message.text).split('\n');

    return {invoice, message, id: parsePaymentRequest({request: invoice}).id};
  };

  // Push the cancel button on an invoice message and return what happened
  const pushCancel = async ({options, text}) => {
    const deleted = [];
    const replies = [];

    const buttons = flatten(options.reply_markup.inline_keyboard);

    const cancel = buttons.find(button => {
      return button.callback_data === callbackCommands.cancelInvoice;
    });

    await handleButtonPush({
      bot,
      id,
      ctx: {
        answerCallbackQuery: async () => {},
        deleteMessage: async () => deleted.push(text),
        reply: async message => replies.push(message),
        update: {
          callback_query: {
            data: cancel.callback_data,
            from: {id},
            message: {text: asText(text)},
          },
        },
      },
      nodes: saved,
    });

    return {replies, deleted: deleted.length};
  };

  try {
    // The target opens a channel to the control node to pay its invoices
    await setupChannel({
      generate: target.generate,
      lnd: target.lnd,
      to: control,
    });

    // Wait for the control node to show up in the target graph
    await asyncRetry({interval, times}, async () => {
      if (!(await getNode({lnd: target.lnd, public_key: control.id})).alias) {
        throw new Error('ExpectedNodeAliasFoundInGraph');
      }
    });

    // An unpaid invoice is canceled and its message is removed
    const unpaid = await createInvoice();

    deepEqual(
      await pushCancel(unpaid.message),
      {deleted: 1, replies: []},
      'Unpaid invoice message is removed'
    );

    const canceled = await getInvoice({id: unpaid.id, lnd: control.lnd});

    deepEqual(canceled.is_canceled, true, 'Invoice is canceled on the node');

    await rejects(
      payViaPaymentRequest({lnd: target.lnd, request: unpaid.invoice}),
      [503, 'PaymentRejectedByDestination'],
      'A canceled invoice cannot be paid'
    );

    // A paid invoice cannot be canceled, but its message is still removed
    const paid = await createInvoice();

    await payViaPaymentRequest({lnd: target.lnd, request: paid.invoice});

    deepEqual(
      await pushCancel(paid.message),
      {deleted: 1, replies: []},
      'Paid invoice message is removed'
    );

    const settled = await getInvoice({id: paid.id, lnd: control.lnd});

    deepEqual(settled.is_confirmed, true, 'Paid invoice stays paid');
  } catch (err) {
    deepEqual(err, null, 'Expected no error');
  } finally {
    await kill({});
  }

  return;
});
