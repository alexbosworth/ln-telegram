const interaction = require('./../interaction');

/** Handle connect command

  Syntax of command:

  /connect

  {
    from: <Message From User Id Number>
    [id]: <Connected User Id Number>
    reply: <Reply Function>
  }
*/
module.exports = ({from, id, reply}) => {
  if (!!id) {
    return reply(interaction.bot_is_connected);
  }

  return reply(`🤖 Connection code is: *${from}*`);
};
