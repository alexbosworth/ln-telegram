const asyncAuto = require('async/auto');
const {getNodeAlias} = require('ln-sync');
const {returnResult} = require('asyncjs-util');

const emoji = '⚡️';
const {isArray} = Array;
const markup = {parse_mode: 'Markdown'};
const niceName = node => node.alias || (node.id || '').substring(0, 8);
const sanitize = n => (n || '').replace(/_/g, '\\_').replace(/[*~`]/g, '');
const tokAsBig = tokens => (tokens / 1e8).toFixed(8);

/** Post settled payment

  {
    from: <Payment From Node String>
    id: <Connected User Id Number>
    lnd: <Authenticated LND API Object>
    nodes: [<Node Id Public Key Hex String>]
    payment: [{
      destination: <Payment Destination Public Key Hex String>
      id: <Payment Hash Hex String>
      [request]: <Payment BOLT11 Request String>
      safe_fee: <Safe Paid Fee Tokens Number>
      safe_tokens: <Safe Paid Tokens Number>
    }]
    send: <Send Message to Telegram User Function>
  }

  @returns via cbk or Promise
  {
    text: <Settled Payment Message Text String>
  }
*/
module.exports = ({from, id, lnd, nodes, payment, send}, cbk) => {
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

        if (!isArray(nodes)) {
          return cbk([400, 'ExpectedArrayOfNodesToPostSettledPayment']);
        }

        if (!payment) {
          return cbk([400, 'ExpectedPaymentToPostSettledPayment']);
        }

        if (!send) {
          return cbk([400, 'ExpectedSendFunctionToPostSettledPayment']);
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
      post: ['details', async ({details}) => {
        const text = `${emoji} ${details} - ${from}`;

        return await send(id, text, markup); 
      }],
    },
    returnResult({reject, resolve}, cbk));
  });
};
