const interaction = require('./../interaction');

/** Handle start command

  Syntax of command:

  /start

  {
    from: <Message From User Id Number>
    [id]: <Connected User Id Number>
    reply: <Reply Function>
  }
*/
module.exports = ({id, reply}) => {
  // Exit early when the bot is already connected
  if (!!id) {
    return reply(interaction.bot_is_connected);
  }

  return reply(interaction.start_message);
};
