const {decodeTrade} = require('paid-services');

const {callbackCommands} = require('./../interface');
const {editQuestions} = require('./../interface');
const {titles} = require('./../interface');

const expectedSpacer = '';
const hasTradePrefix = n => n.startsWith(titles.createdTradePrefix);
const split = n => n.split('\n');
const tradeQuestions = editQuestions.trade.map(n => editQuestions[n]);

/** Is the message a reply to a created invoice

  {
    nodes: [{
      public_key: <Node Identity Public Key Hex String>
    }]
    text: <Message Text String>
  }

  @returns
  {
    [type]: <Trade Secret Action Type String>
  }
*/
module.exports = ({nodes, text}) => {
  // Trade messages have a specific structure
  if (!text || !hasTradePrefix(text)) {
    return {};
  }

  const [, trade, spacer, question, other] = split(text);

  if (!trade || spacer !== expectedSpacer || !!other) {
    return {};
  }

  if (!tradeQuestions.includes(question)) {
    return {};
  }

  // The second line of a trade should be an encoded open trade secret
  try {
    decodeTrade({trade});
  } catch (err) {
    return {};
  }

  const {connect} = decodeTrade({trade});

  if (!connect || !connect.id) {
    return {};
  }

  switch (question) {
  case editQuestions.editTradeDescription:
    return {type: callbackCommands.setTradeDescription};

  default:
    return {};
  }
};
