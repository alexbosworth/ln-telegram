const {parsePaymentRequest} = require('ln-service');

const hasInvoicePrefix = n => n.startsWith('Invoice: ');
const split = n => n.split('\n');

/** Determine if a message is a reply to a created invoice message

  {
    ctx: <Telegram Context Object>
    nodes: [{
      pubic_key: <Node Public Key Hex String>
    }]
  }

  @returns
  <Message is a Reply to Created Invoice Message Bool>
*/
module.exports = ({ctx, nodes}) => {
  if (!ctx || !ctx.update || !ctx.update.message) {
    return false;
  }

  if (!ctx.update.message.reply_to_message) {
    return false;
  }

  const {text} = ctx.update.message.reply_to_message;

  // Invoice messages have a specific structure
  if (!text || !hasInvoicePrefix(text)) {
    return false;
  }

  const [, request] = split(text);

  // The second line of an invoice is a payment request
  try {
    const {destination} = parsePaymentRequest({request});
  } catch (err) {
    return false;
  }

  const {destination} = parsePaymentRequest({request});

  // The node destination must match a node
  if (!nodes.find(n => n.public_key === destination)) {
    return false;
  }

  return true;
};
