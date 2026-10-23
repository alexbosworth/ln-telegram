const asyncAuto = require('async/auto');
const asyncReflect = require('async/reflect');
const {cancelHodlInvoice} = require('ln-service');
const {getInvoice} = require('ln-service');
const {parsePaymentRequest} = require('ln-service');
const {returnResult} = require('asyncjs-util');

const {failureMessage} = require('./../messages');
const interaction = require('./../interaction');

const {isArray} = Array;
const split = n => n.split('\n');

/** User pressed a cancel invoice button

  {
    ctx: <Telegram Context Object>
    nodes: [{
      lnd: <Authenticated LND API Object>
      public_key: <Public Key Hex String>
    }]
  }

  @returns via cbk or Promise
*/
module.exports = ({ctx, nodes}, cbk) => {
  return new Promise((resolve, reject) => {
    return asyncAuto({
      // Check arguments
      validate: cbk => {
        if (!ctx) {
          return cbk([400, 'ExpectedTelegramContextToHandleCancelInvoice']);
        }

        if (!isArray(nodes)) {
          return cbk([400, 'ExpectedArrayOfNodesToHandleCancelInvoice']);
        }

        return cbk();
      },

      // Stop the loading message
      respond: ['validate', async ({}) => await ctx.answerCallbackQuery()],

      // Find the invoice and the node that created it
      invoice: ['validate', asyncReflect(({}, cbk) => {
        const [, request] = split(ctx.update.callback_query.message.text);

        if (!request) {
          return cbk([400, 'ExpectedPaymentRequestToCancelInvoice']);
        }

        try {
          parsePaymentRequest({request});
        } catch (err) {
          return cbk([400, 'ExpectedValidPaymentRequestToCancelInvoice']);
        }

        const {destination, id} = parsePaymentRequest({request});

        const node = nodes.find(n => n.public_key === destination);

        if (!node) {
          return cbk([400, 'MissingNodeToCancelInvoiceFor']);
        }

        return cbk(null, {id, lnd: node.lnd});
      })],

      // Cancel the invoice so that it can no longer be paid
      cancel: ['invoice', asyncReflect(({invoice}, cbk) => {
        // Exit early when there is no invoice to cancel
        if (!invoice.value) {
          return cbk();
        }

        return cancelHodlInvoice({
          id: invoice.value.id,
          lnd: invoice.value.lnd,
        },
        cbk);
      })],

      // Check if an invoice that could not be canceled was already paid
      getInvoice: [
        'cancel',
        'invoice',
        asyncReflect(({cancel, invoice}, cbk) =>
      {
        // Exit early when the invoice was canceled
        if (!cancel.error) {
          return cbk();
        }

        return getInvoice({id: invoice.value.id, lnd: invoice.value.lnd}, cbk);
      })],

      // Remove the invoice message or post why the invoice was not canceled
      remove: [
        'cancel',
        'getInvoice',
        'invoice',
        async ({cancel, getInvoice, invoice}) =>
      {
        const isPaid = !!getInvoice.value && getInvoice.value.is_confirmed;

        // Remove the message when the invoice can no longer be paid
        if (!invoice.error && (!cancel.error || isPaid)) {
          return await ctx.deleteMessage();
        }

        const [, code] = invoice.error || cancel.error;

        // Trying again cannot help when the invoice node is not connected
        const text = code === 'MissingNodeToCancelInvoiceFor' ?
          interaction.cancel_invoice_missing_node :
          interaction.cancel_invoice_failed;

        return await ctx.reply(text, failureMessage({}).actions);
      }],
    },
    returnResult({reject, resolve}, cbk));
  });
};
