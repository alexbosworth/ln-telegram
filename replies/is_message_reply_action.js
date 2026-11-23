const replyActionType = require('./reply_action_type');

/** Determine if a message is a contextual reply that requires a reply action

  {
    ctx: <Telegram Context Object>
    nodes: [{
      public_key: <Node Public Key Hex String>
    }]
  }

  @returns
  <Message is a Reply to Message Action Bool>
*/
module.exports = ({ctx, nodes}) => {
  if (!ctx || !ctx.update || !ctx.update.message) {
    return false;
  }

  if (!ctx.update.message.reply_to_message) {
    return false;
  }

  const {from, text} = ctx.update.message.reply_to_message;

  // Only messages that the bot posted can be reply action messages
  if (!ctx.me || !from || from.id !== ctx.me.id) {
    return false;
  }

  // Reply action messages must fit a specific type
  if (!text || !replyActionType({nodes, text}).type) {
    return false;
  }

  return true;
};
