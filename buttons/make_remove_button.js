const {InlineKeyboard} = require('grammy');

const makeKeyboard = () => new InlineKeyboard();
const removeMessageKeyboard = kb => kb.text('OK', 'remove-message');

/** Make a remove message button

  {}

  @returns
  {
    markup: <Reply Markup Object>
  }
*/
module.exports = ({}) => {
  return {markup: removeMessageKeyboard(makeKeyboard())};
};
