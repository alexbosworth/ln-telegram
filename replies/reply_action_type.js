const invoiceActionType = require('./invoice_action_type');
const tradeActionType = require('./trade_action_type');

/** Determine the type of a reply action, if any

  {
    nodes: [{
      public_key: <Node Public Key Hex String>
    }]
    text: <Message Text String>
  }

  @returns
  {
    [type]: <Type String>
  }
*/
module.exports = ({nodes, text}) => {
  if (!!invoiceActionType({nodes, text}).type) {
    return {type: invoiceActionType({nodes, text}).type};
  }

  if (!!tradeActionType({nodes, text}).type) {
    return {type: tradeActionType({nodes, text}).type};
  }

  return {};
};
