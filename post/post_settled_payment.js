const asyncAuto = require('async/auto');
const {getNodeAlias} = require('ln-sync');
const {returnResult} = require('asyncjs-util');

const sendMessage = require('./send_message');

const emoji = '⚡️';
const {isArray} = Array;
const niceName = node => node.alias || (node.id || '').substring(0, 8);
const sanitize = n => (n || '').replace(/_/g, '\\_').replace(/[*~`]/g, '');
const tokAsBig = tokens => (tokens / 1e8).toFixed(8);

/** Post settled payment

  {
    from: <Payment From Node String>
    id: <Connected User Id Number>
    key: <Telegram API Key String>
    lnd: <Authenticated LND API Object>
    nodes: [<Node Id Public Key Hex String>]
    payment: [{
      destination: <Payment Destination Public Key Hex String>
      id: <Payment Hash Hex String>
      [request]: <Payment BOLT11 Request String>
      safe_fee: <Safe Paid Fee Tokens Number>
      safe_tokens: <Safe Paid Tokens Number>
    }]
    request: <Request Function>
  }

  @returns via cbk or Promise
*/
module.exports = ({from, id, key, lnd, nodes, payment, request}, cbk) => {
  return new Promise((resolve, reject) => {
    return asyncAuto({
      // Check arguments
      validate: cbk => {
        if (!from) {
          return cbk([400, 'ExpectedPaymentFromNameStringToPostPayment']);
        }

        if (!id) {
          return cbk([400, 'ExpectedUserIdToPostSettledPayment']);
        }

        if (!key) {
          return cbk([400, 'ExpectedTelegramApiKeyToPostSettledPayment']);
        }

        if (!isArray(nodes)) {
          return cbk([400, 'ExpectedArrayOfNodesToPostSettledPayment']);
        }

        if (!payment) {
          return cbk([400, 'ExpectedPaymentToPostSettledPayment']);
        }

        if (!request) {
          return cbk([400, 'ExpectedRequestFunctionToPostSettledPayment']);
        }

        return cbk();
      },

      // Find the node that was paid to
      getNode: ['validate', ({}, cbk) => {
        return getNodeAlias({lnd, id: payment.destination}, cbk);
      }],

      // Create the message details
      details: ['getNode', ({getNode}, cbk) => {
        const isTransfer = nodes.includes(payment.destination);
        const routingFee = `. Paid routing fee: ${tokAsBig(payment.safe_fee)}`;
        const sent = tokAsBig(payment.safe_tokens - payment.safe_fee);
        const toNode = `${sanitize(niceName(getNode))}`;

        const action = isTransfer ? 'Transferred' : 'Sent';
        const fee = !payment.safe_fee ? '' : routingFee;

        const details = `${action} ${sent} to ${toNode}${fee}`;

        return cbk(null, details);
      }],

      // Post message
      post: ['details', ({details}, cbk) => {
        const text = `${emoji} ${details} - ${from}`;

        return sendMessage({id, key, request, text}, cbk);
      }],
    },
    returnResult({reject, resolve}, cbk));
  });
};
