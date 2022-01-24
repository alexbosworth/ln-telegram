const asyncAuto = require('async/auto');
const asyncMap = require('async/map');
const asyncReflect = require('async/reflect');
const {cancelHodlInvoice} = require('ln-service');
const {createAnchoredTrade} = require('paid-services');
const {decodeTrade} = require('paid-services');
const {getAnchoredTrade} = require('paid-services');
const {returnResult} = require('asyncjs-util');

const {callbackCommands} = require('./../interface');
const {failureMessage} = require('./../messages');

const failure = msg => `⚠️ Unexpected error \`${msg}\`. Try again?`;
const {isArray} = Array;
const partialNodeId = (command, data) => data.slice(command.length);
const split = n => n.split('\n');

/** User pressed button to update created trade

  {
    ctx: <Telegram Context Object>
    nodes: [{
      public_key: <Public Key Hex String>
    }]
  }

  @returns via cbk or Promise
*/
module.exports = ({ctx, nodes}, cbk) => {
  return new Promise((resolve, reject) => {
    return asyncAuto({
      // Check arguments
      validate: cbk => {
        if (!ctx) {
          return cbk([400, 'ExpectedTelegramContextToMoveTradeSecret']);
        }

        if (!isArray(nodes)) {
          return cbk([400, 'ExpectedArrayOfNodesToMoveTradeSecret']);
        }

        return cbk();
      },

      // Stop the loading message
      respond: ['validate', async ({}) => await ctx.answerCallbackQuery()],

      // Pull out the trade details
      trade: ['validate', asyncReflect(({}, cbk) => {
        const [title, trade] = split(ctx.update.callback_query.message.text);

        if (!title) {
          return cbk([400, 'ExpectedTradeTitleToMoveTradeNode']);
        }

        if (!trade) {
          return cbk([400, 'ExpectedEncodedTradeToMoveTradeNode']);
        }

        // Make sure the trade is a regular trade-secret
        try {
          decodeTrade({trade});
        } catch (err) {
          return cbk([400, 'ExpectedValidTradeToMoveTradeNode']);
        }

        const {connect} = decodeTrade({trade});

        if (!connect) {
          return cbk([400, 'ExpectedOpenTradeToMoveTradeNode']);
        }

        const {id} = connect;

        if (!id) {
          return cbk([400, 'ExpectedTradeIdToMoveTradeNode']);
        }

        const command = callbackCommands.moveTradeNode;
        const {data} = ctx.update.callback_query;

        const destination = nodes.find(node => {
          return node.public_key.startsWith(partialNodeId(command, data));
        });

        if (!destination) {
          return cbk([400, 'ExpectedKnownDestinationNodeToMoveTradeTo']);
        }

        // Fetch the full details of the trade
        return asyncMap(nodes, (node, cbk) => {
          return getAnchoredTrade({id, lnd: node.lnd}, (err, res) => {
            if (!!err) {
              return cbk(err);
            }

            // Exit early when there is no trade on this node
            if (!res.trade) {
              return cbk();
            }

            return cbk(null, {
              lnd: node.lnd,
              public_key: node.public_key,
              trade: res.trade,
            });
          });
        },
        (err, res) => {
          if (!!err) {
            return cbk(err);
          }

          const [found] = res.filter(n => !!n);

          if (!found) {
            return cbk([404, 'FailedToFindRelatedAnchoredTradeToMove']);
          }

          return cbk(null, {
            id,
            description: found.trade.description,
            destination: found.public_key,
            expires_at: found.trade.expires_at,
            lnd: found.lnd,
            move_lnd: destination.lnd,
            secret: found.trade.secret,
            tokens: found.trade.tokens,
          });
        });
      })],

      // Cancel the anchored invoice
      cancel: ['trade', asyncReflect(({trade}, cbk) => {
        if (!!trade.error) {
          return cbk();
        }

        return cancelHodlInvoice({
          id: trade.value.id,
          lnd: trade.value.lnd,
        },
        cbk);
      })],

      // Remove the referenced message
      remove: ['cancel', async ({}) => await ctx.deleteMessage()],

      // Recreate the trade on the move-to node
      move: ['cancel', 'trade', asyncReflect(({cancel, trade}, cbk) => {
        // Exit early when the trade could not be canceled or there is no trade
        if (!!cancel.error || !trade.value) {
          return cbk();
        }

        return createAnchoredTrade({
          description: trade.value.description,
          expires_at: trade.value.expires_at,
          lnd: trade.value.move_lnd,
          secret: trade.value.secret,
          tokens: trade.value.tokens,
        },
        cbk);
      })],

      // Post about a failure to cancel, recreate, or get the trade
      failure: ['cancel', 'move', 'trade', async ({cancel, move, trade}) => {
        if (!cancel.error && !move.error && !trade.error) {
          return;
        }

        const [, message] = cancel.error || move.error || trade.error;

        return await ctx.reply(failure(message), failureMessage({}).actions);
      }],
    },
    returnResult({reject, resolve}, cbk));
  });
};
