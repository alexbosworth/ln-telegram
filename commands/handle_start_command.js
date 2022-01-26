const interaction = require('./../interaction');

const escape = text => text.replace(/[_[\]()~`>#+\-=|{}.!\\]/g, '\\\$&');

/** Handle connect command

  Syntax of command:

  /connect

  {
    from: <Message From User Id Number>
    [id]: <Connected User Id Number>
    reply: <Reply Function>
  }
*/
module.exports = ({id, reply}) => {
  if (!!id) {
    return reply(escape(interaction.bot_is_connected));
  }

  return reply(escape(interaction.start_message));
};
