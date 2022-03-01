const asyncAuto = require('async/auto');
const {getChannels} = require('ln-service');
const {getNodeAlias} = require('ln-sync');
const {returnResult} = require('asyncjs-util');
const {subscribeToPastPayment} = require('ln-service');

const {icons} = require('./../interface');

const asPercent = (fee, tokens) => (fee / tokens * 100).toFixed(2);
const asPpm = (fee, tokens) => (fee / tokens * 1e6).toFixed();
const escape = text => text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\\$&');
const {isArray} = Array;
const niceName = node => node.alias || (node.id || '').substring(0, 8);
const sanitize = n => (n || '').replace(/_/g, '\\_').replace(/[*~`]/g, '');
const tokensAsBigUnit = tokens => (tokens / 1e8).toFixed(8);

/** Get a rebalance message

  {
    fee: <Payment Fee Tokens Number>
    hops: [{
      public_key: <Forwarding Node Public Key Hex String>
    }]
    lnd: <Authenticated LND API Object>
    payments: [{
      in_channel: <Incoming Payment Through Channel Id String>
    }]
    received: <Received Tokens Number>
  }

  @returns via cbk or Promise
  {
    icon: <Message Icon String>
    message: <Rebalance Message String>
  }
*/
module.exports = ({fee, hops, lnd, payments, received}, cbk) => {
  return new Promise((resolve, reject) => {
    return asyncAuto({
      // Check arguments
      validate: cbk => {
        if (fee === undefined) {
          return cbk([400, 'ExpectedPaidFeeToGetRebalanceMessage']);
        }

        if (!isArray(hops)) {
          return cbk([400, 'ExpectedArrayOfHopsToGetRebalanceMessage']);
        }

        if (!lnd) {
          return cbk([400, 'ExpectedLndToGetRebalanceMessage']);
        }

        if (!isArray(payments)) {
          return cbk([400, 'ExpectedPaymentsToGetRebalanceMessage']);
        }

        if (received === undefined) {
          return cbk([400, 'ExpectedReceivedAmountToGetRebalanceMessage']);
        }

        return cbk();
      },

      // Get channels to figure out who the inbound peer is
      getChannels: ['validate', ({}, cbk) => {
        const [inPayment] = payments;

        if (!inPayment) {
          return cbk();
        }

        return getChannels({lnd}, cbk);
      }],

      // Get outbound peer alias
      getOut: ['validate', ({}, cbk) => {
        const [firstHop] = hops;

        if (!firstHop) {
          return cbk(null, {});
        }

        return getNodeAlias({lnd, id: firstHop.public_key}, cbk);
      }],

      // Get inbound peer alias
      getIn: ['getChannels', ({getChannels}, cbk) => {
        const [inPayment] = payments;

        if (!inPayment) {
          return cbk();
        }

        // Figure out who the channel is with
        const {channels} = getChannels;

        const inChannel = channels.find(n => n.id === inPayment.in_channel);

        // Exit early when the inbound channel is unknown
        if (!inChannel) {
          return cbk();
        }

        return getNodeAlias({lnd, id: inChannel.partner_public_key}, cbk);
      }],

      // Derive a description of the rebalance
      rebalanceDescription: ['getIn', 'getOut', ({getIn, getOut}, cbk) => {
        const amount = escape(tokensAsBigUnit(received));
        const feeAmount = escape(tokensAsBigUnit(fee));
        const feePercent = escape(asPercent(fee, received));
        const feeRate = escape(`(${asPpm(fee, received)})`);
        const separator = escape('. Fee: ');
        const withNode = `${escape(niceName(getOut))}`;

        const feeInfo = `${feeAmount} ${feePercent}% ${feeRate}`;
        const increase = `Rebalanced ${amount} out ${withNode}`;

        // Exit early when there is no inbound peer info
        if (!getIn) {
          return cbk(null, `${increase}${separator}${feeInfo}`);
        }

        const fromNode = escape(niceName(getIn));

        return cbk(null, `${increase} *→* ${fromNode}${separator}${feeInfo}`);
      }],

      // Final message result
      message: ['rebalanceDescription', ({rebalanceDescription}, cbk) => {
        return cbk(null, {
          icon: icons.rebalance,
          message: rebalanceDescription,
        });
      }],
    },
    returnResult({reject, resolve, of: 'message'}, cbk));
  });
};
