const {InlineKeyboard} = require('grammy');

const makeKeyboard = () => new InlineKeyboard();
const genericError = '⚠️ _Unexpected error :(_'
const invalidNumber = '⚠️ _Amount not understood. Try a number?_';
const invalidInt = '⚠️ _Amount not understood. Try a non-fractional number? _';
const parseMode = 'Markdown';

/** Get a failure message

  {
    [is_fractional_amount]: <Failure is Fractional Amount Bool>
    [is_invalid_amount]: <Failure Is Invalid Amount Bool>
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

  return {actions, message: genericError};
};
