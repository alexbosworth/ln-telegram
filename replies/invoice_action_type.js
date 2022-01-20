const {parsePaymentRequest} = require('ln-service');

const {callbackCommands} = require('./../interface');
const {editQuestions} = require('./../interface');
const {titles} = require('./../interface');

const expectedSpacer = '';
const hasInvoicePrefix = n => n.startsWith(titles.createdInvoicePrefix);
const invoiceQuestions = editQuestions.invoice.map(n => editQuestions[n]);
const split = n => n.split('\n');

/** Is the message a reply to a created invoice

  {
    text: <Message Text String>
    nodes: [{
      public_key: <Node Identity Public Key Hex String>
    }]
  }

  @returns
  {
    [type]: <Invoice Action Type String>
  }
*/
module.exports = ({nodes, text}) => {
  // Invoice messages have a specific structure
  if (!text || !hasInvoicePrefix(text)) {
    return {};
  }

  const [, request, spacer, question, other] = split(text);

  if (!request || spacer !== expectedSpacer || !!other) {
    return {};
  }

  if (!invoiceQuestions.includes(question)) {
    return {};
  }

  // The second line of an invoice should be a payment request
  try {
    parsePaymentRequest({request});
  } catch (err) {
    return {};
  }

  const {destination} = parsePaymentRequest({request});

  // The invoice destination must match a node
  if (!nodes.find(n => n.public_key === destination)) {
    return {};
  }

  switch (question) {
  case editQuestions.editInvoiceDescription:
    return {type: callbackCommands.setInvoiceDescription};

  case editQuestions.editInvoiceTokens:
    return {type: callbackCommands.setInvoiceTokens};

  default:
    return {};
  }
};
