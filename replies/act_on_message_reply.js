const asyncAuto = require('async/auto');
const {returnResult} = require('asyncjs-util');

const {callbackCommands} = require('./../interface');
const replyActionType = require('./reply_action_type');
const updateInvoiceFromReply = require('./update_invoice_from_reply');
const updateTradeFromReply = require('./update_trade_from_reply');

const {isArray} = Array;

/** Act on a reply

  {
    api: <Bot API Object>
    ctx: <Telegram Context Object>
    id: <Connected User Id Number>
    nodes: [{
      lnd: <Authenticated LND API Object>
      public_key: <Node Identity Public Key Hex String>
    }]
  }

  @returns via cbk or Promise
*/
module.exports = ({api, ctx, id, nodes, request}, cbk) => {
  return new Promise((resolve, reject) => {
    return asyncAuto({
      // Check arguments
      validate: cbk => {
        if (!api) {
          return cbk([400, 'ExpectedTelegramApiToActOnMessageReply']);
        }

        if (!ctx) {
          return cbk([400, 'ExpectedTelegramContextToActOnMessageReply']);
        }

        if (!id) {
          return cbk([400, 'ExpectedConnectedUserIdToActOnMessageReply']);
        }

        if (!isArray(nodes)) {
          return cbk([400, 'ExpectedArrayOfNodesToActOnMessageReply']);
        }

        if (!request) {
          return cbk([400, 'ExpectedRequestFunctionToActOnMessageReply']);
        }

        return cbk();
      },

      // Determine action type
      type: ['validate', ({}, cbk) => {
        if (!ctx || !ctx.update || !ctx.update.message) {
          return cbk();
        }

        if (!ctx.update.message.reply_to_message) {
          return cbk();
        }

        const {text} = ctx.update.message.reply_to_message;

        // Reply action messages must fit a specific type
        if (!text) {
          return cbk();
        }

        return cbk(null, replyActionType({nodes, text}).type);
      }],

      // Execute update
      update: ['type', ({type}, cbk) => {
        // Exit early when the action type is unknown
        if (!type) {
          return cbk();
        }

        switch (type) {
        case callbackCommands.setInvoiceDescription:
        case callbackCommands.setInvoiceTokens:
          return updateInvoiceFromReply({api, ctx, id, nodes, request}, cbk);

        case callbackCommands.setTradeDescription:
        case callbackCommands.setTradeExpiresAt:
          return updateTradeFromReply({api, ctx, id, nodes}, cbk);

        default:
          return cbk();
        }
      }],
    },
    returnResult({reject, resolve}, cbk));
  });
};
