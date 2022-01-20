const replyActionType = require('./reply_action_type');

const split = n => n.split('\n');

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

  const {text} = ctx.update.message.reply_to_message;

  // Reply action messages must fit a specific type
  if (!text || !replyActionType({nodes, text}).type) {
    return false;
  }

  return true;
};
