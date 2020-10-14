const asyncAuto = require('async/auto');
const {getPayment} = require('ln-service');
const {returnResult} = require('asyncjs-util');

const getRebalanceMessage = require('./get_rebalance_message');
const getReceivedMessage = require('./get_received_message');
const sendMessage = require('./send_message');

const earnEmoji = '💰';
const rebalanceEmoji = '☯️';

/** Post settled invoices

  {
    from: <Invoice From Node String>
    id: <Connected User Id Number>
    invoice: {
      description: <Invoice Description String>
      id: <Invoice Preimage Hash Hex String>
      is_confirmed: <Invoice is Settled Bool>
      payments: [{
        [confirmed_at]: <Payment Settled At ISO 8601 Date String>
        created_at: <Payment Held Since ISO 860 Date String>
        created_height: <Payment Held Since Block Height Number>
        in_channel: <Incoming Payment Through Channel Id String>
        is_canceled: <Payment is Canceled Bool>
        is_confirmed: <Payment is Confirmed Bool>
        is_held: <Payment is Held Bool>
        messages: [{
          type: <Message Type Number String>
          value: <Raw Value Hex String>
        }]
        mtokens: <Incoming Payment Millitokens String>
        [pending_index]: <Pending Payment Channel HTLC Index Number>
        tokens: <Payment Tokens Number>
        [total_mtokens]: <Total Payment Millitokens String>
      }]
      received: <Received Tokens Number>
    }
    key: <Telegram API Key String>
    lnd: <Authenticated LND API Object>
    request: <Request Function>
  }

  @returns via cbk or Promise
*/
module.exports = ({from, id, invoice, key, lnd, request}, cbk) => {
  return new Promise((resolve, reject) => {
    return asyncAuto({
      // Check arguments
      validate: cbk => {
        if (!from) {
          return cbk([400, 'ExpectedFromNameToPostSettledInvoice']);
        }

        if (!id) {
          return cbk([400, 'ExpectedUserIdNumberToPostSettledInvoice']);
        }

        if (!invoice) {
          return cbk([400, 'ExpectedInvoiceToPostSettledInvoice']);
        }

        if (!key) {
          return cbk([400, 'ExpectedTelegramApiKeyToPostSettledInvoice']);
        }

        if (!lnd) {
          return cbk([400, 'ExpectedLndObjectToPostSettledInvoice']);
        }

        if (!request) {
          return cbk([400, 'ExpectedRequestFunctionToPostSettledInvoice']);
        }

        return cbk();
      },

      // Find associated payment
      getPayment: ['validate', ({}, cbk) => {
        // Exit early when the invoice has yet to be confirmed
        if (!invoice.is_confirmed) {
          return cbk();
        }

        return getPayment({lnd, id: invoice.id}, (err, res) => {
          // Exit early when there is no found payment
          if (!!err) {
            return cbk();
          }

          return cbk(null, res);
        });
      }],

      // Details for message
      details: ['getPayment', ({getPayment}, cbk) => {
        // Exit early when the invoice has yet to be confirmed
        if (!invoice.is_confirmed) {
          return cbk();
        }

        // Exit early when this is a rebalance
        if (!!getPayment) {
          return getRebalanceMessage({
            lnd,
            fee: getPayment.payment.fee,
            hops: getPayment.payment.hops,
            payments: invoice.payments,
            received: invoice.received,
          },
          cbk);
        }

        return getReceivedMessage({
          lnd,
          description: invoice.description,
          payments: invoice.payments,
          received: invoice.received,
        },
        cbk);
      }],

      // Post invoice
      post: ['details', 'getPayment', ({details, getPayment}, cbk) => {
        // Exit early when there is nothing to post
        if (!details) {
          return cbk();
        }

        const emoji = !getPayment ? earnEmoji : rebalanceEmoji;

        const text = `${emoji} ${from}\n${details.message}`;

        return sendMessage({id, key, request, text}, cbk);
      }],
    },
    returnResult({reject, resolve}, cbk));
  });
};
