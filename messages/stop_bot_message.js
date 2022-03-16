const {InlineKeyboard} = require('grammy');

const {callbackCommands} = require('./../interface');
const {icons} = require('./../interface');
const {labels} = require('./../interface');

const {removeMessage} = callbackCommands;
const {terminateBot} = callbackCommands;
const {stopBotCancelButtonLabel} = labels;
const {stopBotConfirmButtonLabel} = labels;
const mode = 'MarkdownV2';

/** Create a stop bot message

  {}

  @returns
  {
    markup: <Reply Markup Object>
    mode: <Message Parse Mode String>
    text: <Message Text String>
  }
*/
module.exports = args => {
  const markup = new InlineKeyboard();

  markup.text(stopBotCancelButtonLabel, terminateBot);
  markup.text(stopBotConfirmButtonLabel, removeMessage);

  const text = `${icons.bot} Are you sure that you want to stop the bot?`;

  return {markup, mode, text};
};
