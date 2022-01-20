const asyncAuto = require('async/auto');
const asyncMap = require('async/map');
const asyncReflect = require('async/reflect');
const {cancelHodlInvoice} = require('ln-service');
const {createAnchoredTrade} = require('paid-services');
const {decodeTrade} = require('paid-services');
const {getAnchoredTrade} = require('paid-services');
const {returnResult} = require('asyncjs-util');

const {callbackCommands} = require('./../interface');
const {checkAccess} = require('./../authentication');
const {createTradeMessage} = require('./../messages');
const {editQuestions} = require('./../interface');
const {failureMessage} = require('./../messages');
const {postCreatedTrade} = require('./../post');
const tradeActionType = require('./trade_action_type');

const failure = message => `⚠️ Failed to update trade: ${message}.`;
const {isArray} = Array;
const maxDescriptionLength = 100;
const split = n => n.split('\n');

/** Update the details of a created trade from reply input

  {
    api: <Bot API Object>
    ctx: <Telegram Context Object>
    nodes: [{
      lnd: <Authenticated LND API Object>
      public_key: <Node Identity Public Key Hex String>
    }]
  }

  @returns via cbk or Promise
*/
module.exports = ({api, ctx, id, nodes}, cbk) => {
  return new Promise((resolve, reject) => {
    return asyncAuto({
      // Check arguments
      validate: cbk => {
        if (!api) {
          return cbk([400, 'ExpectedTelegramApiToUpdateTradeFromReply']);
        }

        if (!ctx) {
          return cbk([400, 'ExpectedTelegramContextToUpdateTradeFromReply']);
        }

        if (!id) {
          return cbk([400, 'ExpectedConnectedUserIdToUpdateTradeFromReply']);
        }

        if (!isArray(nodes)) {
          return cbk([400, 'ExpectedArrayOfNodesToUpdateTradeFromReply']);
        }

        return cbk();
      },

      // Confirm access authorization
      checkAccess: ['validate', ({}, cbk) => {
        return checkAccess({
          id,
          from: ctx.message.from.id,
          reply: ctx.reply,
        },
        cbk);
      }],

      // Get the referenced trade
      getTrade: ['checkAccess', asyncReflect(({}, cbk) => {
        // The encoded trade is the 2nd line
        const [, trade] = split(ctx.update.message.reply_to_message.text);

        try {
          decodeTrade({trade});
        } catch (err) {
          return cbk([400, 'ExpectedValidTradeToUpdateTradeFromReply', {err}]);
        }

        const {connect} = decodeTrade({trade});

        if (!connect) {
          return cbk([400, 'ExpectedOpenTradeToUpdateTradeFromReply']);
        }

        if (!connect.id) {
          return cbk([400, 'ExpectedOpenTradeIdToUpdateTradeFromReply']);
        }

        return asyncMap(nodes, ({lnd}, cbk) => {
          return getAnchoredTrade({lnd, id: connect.id}, (err, res) => {
            if (!!err) {
              return cbk(err);
            }

            // Exit early when there is no trade on this node
            if (!res.trade) {
              return cbk();
            }

            return cbk(null, {lnd, trade: res.trade});
          });
        },
        (err, res) => {
          if (!!err) {
            return cbk(err);
          }

          const [anchor] = res.filter(n => !!n);

          if (!anchor) {
            return cbk([400, 'CannotFindAnchoredTradeForId']);
          }

          return cbk(null, {
            description: anchor.trade.description,
            expires_at: anchor.trade.expires_at,
            id: connect.id,
            lnd: anchor.lnd,
            secret: anchor.trade.secret,
            tokens: anchor.trade.tokens,
          });
        });
      })],

      // Determine what type of edit message this is
      type: ['checkAccess', ({}, cbk) => {
        const {text} = ctx.update.message.reply_to_message;

        const {type} = tradeActionType({nodes, text});

        return cbk(null, type);
      }],

      // Delete the answer message
      deleteAnswer: ['type', async ({type}) => {
        return !!type ? await ctx.deleteMessage() : null;
      }],

      // Delete the edit message
      deleteQuestion: ['type', async ({type}) => {
        if (!type) {
          return;
        }

        return await api.deleteMessage(
          ctx.update.message.reply_to_message.chat.id,
          ctx.update.message.reply_to_message.message_id,
        );
      }],

      // Details for the updated new anchored trade
      update: ['getTrade', 'type', asyncReflect(({getTrade, type}, cbk) => {
        // Exit early when the type of update is not known
        if (!type) {
          return cbk();
        }

        // Exit early when there was an error getting the trade
        if (!!getTrade.error) {
          return cbk(getTrade.error);
        }

        const {text} = ctx.update.message;

        switch (type) {
        case callbackCommands.setTradeDescription:
          // Exit early when the description is too long
          if (!!type.description && text.length > maxDescriptionLength) {
            return cbk([400, 'ExpectedShorterDescriptionForTrade']);
          }

          return cbk(null, {
            description: text,
            expires_at: getTrade.value.expires_at,
            id: getTrade.value.id,
            lnd: getTrade.value.lnd,
            secret: getTrade.value.secret,
            tokens: getTrade.value.tokens,
          });

        default:
          return cbk();
        }
      })],

      // Remove the existing open trade
      removeTrade: ['update', asyncReflect(({update}, cbk) => {
        // Exit early when there was an issue with the update
        if (!!update.error) {
          return cbk();
        }

        const {id, lnd} = update.value;

        return cancelHodlInvoice({id, lnd}, cbk);
      })],

      // Create the updated open trade
      recreateTrade: [
        'removeTrade',
        'update',
        asyncReflect(({removeTrade, update}, cbk) =>
      {
        // Exit early when the trade could not be removed or the update is bad
        if (!!removeTrade.error || !!update.error) {
          return cbk();
        }

        return createAnchoredTrade({
          description: update.value.description,
          expires_at: update.value.expires_at,
          lnd: update.value.lnd,
          secret: update.value.secret,
          tokens: update.value.tokens,
        },
        cbk);
      })],

      // Post a failure message
      postFailure: [
        'recreateTrade',
        'removeTrade',
        'update',
        async ({recreateTrade, removeTrade, update}) =>
      {
        const error = recreateTrade.error || removeTrade.error || update.error;

        // Exit early when there is no failure
        if (!error) {
          return;
        }

        const {actions} = failureMessage({});
        const [, message] = error;

        return await ctx.reply(failure(message), actions);
      }],
    },
    returnResult({reject, resolve}, cbk));
  });
};
