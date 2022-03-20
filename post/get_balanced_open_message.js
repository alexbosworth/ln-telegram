const asyncAuto = require('async/auto');
const {getNodeAlias} = require('ln-sync');
const {returnResult} = require('asyncjs-util');

const {icons} = require('./../interface');
const {formatTokens} = require('./../interface');

const escape = text => text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\\$&');
const formatCapacity = tokens => formatTokens({tokens}).display;
const fromName = res => res.alias || res.id.substring(0, 8);
const join = arr => arr.join('\n');

/** Get a message representing a balanced open proposal

  {
    capacity: <Channel Size Tokens Number>
    from: <Proposal From Identity Public Key Hex String>
    lnd: <Authenticated LND API Object>
    rate: <Chain Tokens Fee Rate Number>
  }

  @returns via cbk or Promise
  {
    icon: <Message Icon String>
    message: <Message String>
  }
*/
module.exports = ({capacity, from, lnd, rate}, cbk) => {
  return new Promise((resolve, reject) => {
    return asyncAuto({
      // Check arguments
      validate: cbk => {
        if (!capacity) {
          return cbk([400, 'ExpectedBalancedProposalCapacityToGetMessage']);
        }

        if (!from) {
          return cbk([400, 'ExpectedProposalFromPublicKeyToGetMessage']);
        }

        if (!lnd) {
          return cbk([400, 'ExpectedLndToGetBalancedOpenMessage']);
        }

        if (!rate) {
          return cbk([400, 'ExpectedFeeRateToGetBalancedOpenMessage']);
        }

        return cbk();
      },

      // Get node alias
      getAlias: ['validate', ({}, cbk) => getNodeAlias({lnd, id: from}, cbk)],

      // Message to post
      message: ['getAlias', ({getAlias}, cbk) => {
        const proposal = `${formatCapacity(capacity)} balanced channel open`;

        const elements = [
          escape(`Received a ${proposal} proposal from ${fromName(getAlias)}`),
          `\`${from}\``,
          `Proposed chain fee rate: ${rate}/vbyte`,
        ];

        return cbk(null, {icon: icons.balanced_open, message: join(elements)});
      }],
    },
    returnResult({reject, resolve, of: 'message'}, cbk));
  });
};
