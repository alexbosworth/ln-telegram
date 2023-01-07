const asyncAuto = require('async/auto');
const asyncMap = require('async/map');
const {getNodeAlias} = require('ln-sync');
const {returnResult} = require('asyncjs-util');

const {icons} = require('./../interface');
const {formatTokens} = require('./../interface');

const display = tokens => formatTokens({tokens}).display;
const escape = text => text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\\$&');
const {isArray} = Array;
const join = arr => arr.join(', ');
const markup = {parse_mode: 'MarkdownV2'};
const niceName = node => node.alias || node.id.substring(0, 8);

/** Post settled payment

  {
    from: <Payment From Node String>
    id: <Connected User Id Number>
    lnd: <Authenticated LND API Object>
    nodes: [<Node Id Public Key Hex String>]
    payment: {
      destination: <Payment Destination Public Key Hex String>
      id: <Payment Hash Hex String>
      [paths]: [{
        hops: [{
          public_key: <Public Key Hex String>
        }]
      }]
      [request]: <Payment BOLT11 Request String>
      safe_fee: <Safe Paid Fee Tokens Number>
      safe_tokens: <Safe Paid Tokens Number>
    }
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

        if (!lnd) {
          return cbk([400, 'ExpectedLndToPostSettledPayment']);
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

      // Get the aliases for relays
      getRelays: ['validate', ({}, cbk) => {
        return asyncMap(payment.paths || [], (path, cbk) => {
          const [hop] = path.hops;

          if (!hop) {
            return cbk();
          }

          return getNodeAlias({lnd, id: hop.public_key}, cbk);
        },
        cbk);
      }],

      // Create the message details
      message: ['getNode', 'getRelays', ({getNode, getRelays}, cbk) => {
        const isTransfer = nodes.includes(payment.destination);
        const routingFee = `. Paid routing fee: ${display(payment.safe_fee)}`;
        const sent = display(payment.safe_tokens - payment.safe_fee);
        const toNode = niceName(getNode);
        const via = ` out ${join(getRelays.filter(n => !!n).map(niceName))}`;

        const action = isTransfer ? 'Transferred' : 'Sent';
        const fee = !payment.safe_fee ? '' : routingFee;

        const details = escape(`${action} ${sent} to ${toNode}${via}${fee} -`);

        return cbk(null, `${icons.spent} ${details} _${escape(from)}_`);
      }],

      // Post message summarizing the payment
      post: ['message', async ({message}) => {
        return await send(id, message, markup);
      }],
    },
    returnResult({reject, resolve, of: 'message'}, cbk));
  });
};
