const {InlineKeyboard} = require('grammy');
const {parsePaymentRequest} = require('ln-service');

const {callbackCommands} = require('./../interface');
const {formatTokens} = require('./../interface');
const {labels} = require('./../interface');
const {titles} = require('./../interface');

const {cancelInvoice} = callbackCommands;
const {invoiceMessageCancelButtonLabel} = labels;
const {invoiceMessageDescriptionButtonLabel} = labels;
const {invoiceMessageNodeButtonLabel} = labels;
const {invoiceMessageSetTokensButtonLabel} = labels;
const join = arr => arr.filter(n => !!n).join('\n');
const mode = 'Markdown';
const {setInvoiceDescription} = callbackCommands;
const {setInvoiceNode} = callbackCommands;
const {setInvoiceTokens} = callbackCommands;

/** Create an invoice message

  {
    [from]: <Invoice From Node String>
    request: <BOLT 11 Payment Request String>
    [rate]: <Exchange Rate String>
  }

  @returns
  {
    markup: <Reply Markup Object>
    mode: <Message Parse Mode String>
    text: <Message Text String>
  }
*/
module.exports = ({from, rate, request}) => {
  const markup = new InlineKeyboard();

  const {description, tokens} = parsePaymentRequest({request});

  markup.text(invoiceMessageDescriptionButtonLabel, setInvoiceDescription);
  markup.text(invoiceMessageSetTokensButtonLabel, setInvoiceTokens);

  if (!!from) {
    markup.text(invoiceMessageNodeButtonLabel, setInvoiceNode);
  }

  markup.text(invoiceMessageCancelButtonLabel, cancelInvoice);

  const memo = !description ? '' : `“${description}”`;

  const exchangeRate = !!rate ? `\nExchange rate: $${rate}\n` : '';

  const text = join([
    `${titles.createdInvoicePrefix}${formatTokens({tokens}).display} ${memo}`,
    `\`${request}\``,
    `${exchangeRate}`,
    `${from || ''}`,
  ]);

  return {markup, mode, text};
};
