const {InlineKeyboard} = require('grammy');

const makeKeyboard = () => new InlineKeyboard();
const genericError = '⚠️ _Unexpected error :(_'
const invalidNumber = '⚠️ _Amount not understood. Try a number?_';
const invalidInt = '⚠️ _Amount not understood. Try a non-fractional number? _';
const paidInvoice = '⚠️ _Invoice already paid, so it cannot be changed._';
const parseMode = 'Markdown';

/** Get a failure message

  {
    [is_fractional_amount]: <Failure is Fractional Amount Bool>
    [is_invalid_amount]: <Failure Is Invalid Amount Bool>
    [is_paid_invoice]: <Failure is Invoice Already Paid Bool>
  }

  @returns
  {
    actions: {
      parse_mode: <Parse Mode String>
      reply_markup: <Reply Markup Object>
    }
    message: <Failure Message String>
  }
*/
module.exports = args => {
  const removeMessageKeyboard = kb => kb.text('OK', 'remove-message');

  const actions = {
    parse_mode: parseMode,
    reply_markup: removeMessageKeyboard(makeKeyboard()),
  };

  if (!!args.is_fractional_amount) {
    return {actions, message: invalidInt};
  }

  if (!!args.is_invalid_amount) {
    return {actions, message: invalidNumber};
  }

  if (!!args.is_paid_invoice) {
    return {actions, message: paidInvoice};
  }

  return {actions, message: genericError};
};
