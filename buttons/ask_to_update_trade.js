const asyncAuto = require('async/auto');
const asyncMap = require('async/map');
const asyncReflect = require('async/reflect');
const {decodeTrade} = require('paid-services');
const {getAnchoredTrade} = require('paid-services');
const {returnResult} = require('asyncjs-util');

const {callbackCommands} = require('./../interface');
const {editQuestions} = require('./../interface');
const {failureMessage} = require('./../messages');

const code = n => `\`${n}\``;
const escape = text => text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\\$&');
const failure = msg => `⚠️ Unexpected error \`${msg}\`. Try again?`;
const {isArray} = Array;
const italic = n => `_${n}_`;
const join = n => n.join('\n');
const parseMode = 'MarkdownV2';
const spacer = '';
const split = n => n.split('\n');

/** User pressed button to update created trade

  {
    command: <Callback Command String>
    ctx: <Telegram Context Object>
    nodes: [{
      public_key: <Public Key Hex String>
    }]
  }

  @returns via cbk or Promise
*/
module.exports = ({command, ctx, nodes}, cbk) => {
  return new Promise((resolve, reject) => {
    return asyncAuto({
      // Check arguments
      validate: cbk => {
        if (!command) {
          return cbk([400, 'ExpectedButtonCommandToUpdateTradeDetails']);
        }

        if (!ctx) {
          return cbk([400, 'ExpectedTelegramContextToUpdateTradeDetails']);
        }

        if (!isArray(nodes)) {
          return cbk([400, 'ExpectedArrayOfNodesToUpdateTradeDetails']);
        }

        return cbk();
      },

      // Derive the labels to put for the command
      ui: ['validate', ({}, cbk) => {
        switch (command) {
        // Update the trade description
        case callbackCommands.setTradeDescription:
          return cbk(null, {
            placeholder: editQuestions.placeholderTradeDescription,
            question: editQuestions.editTradeDescription,
          });

        // Update the trade expires_at
        case callbackCommands.setTradeExpiresAt:
          return cbk(null, {
            placeholder: editQuestions.placeholderTradeExpiresAt,
            question: editQuestions.editTradeExpiresAt,
          });

        default:
          return cbk([400, 'ExpectedKnownCommandToUpdateOpenTradeDetails']);
        }
      }],

      // Stop the loading message
      respond: ['ui', async ({}) => await ctx.answerCallbackQuery()],

      // Pull out the trade id and context labels
      trade: ['ui', asyncReflect(({}, cbk) => {
        const [title, trade] = split(ctx.update.callback_query.message.text);

        if (!title) {
          return cbk([400, 'ExpectedTradeTitleOnTradeMessage']);
        }

        if (!trade) {
          return cbk([400, 'ExpectedEncodedTradeOnTradeMessage']);
        }

        try {
          decodeTrade({trade});
        } catch (err) {
          return cbk([400, 'ExpectedValidTradeToUpdateTradeDetails']);
        }

        const {connect} = decodeTrade({trade});

        if (!connect) {
          return cbk([400, 'ExpectedOpenTradeToUpdateTradeDetails']);
        }

        const {id} = connect;

        if (!id) {
          return cbk([400, 'ExpectedTradeIdToUpdateTradeDetails']);
        }

        // Make sure the trade is present on a node
        return asyncMap(nodes, ({lnd}, cbk) => {
          return getAnchoredTrade({lnd, id}, cbk);
        },
        (err, res) => {
          if (!!err) {
            return cbk(err);
          }

          const [found] = res.map(n => n.trade).filter(n => !!n);

          if (!found) {
            return cbk([404, 'FailedToFindRelatedAnchoredTrade']);
          }

          return cbk(null, {id, title, encoded: trade});
        });
      })],

      // Post the edit trade message
      post: ['trade', 'ui', async ({trade, ui}) => {
        // Exit early when there is no trade
        if (!trade.value) {
          return;
        }

        // Post the edit trade message
        return await ctx.reply(
          join([
            escape(trade.value.title),
            code(trade.value.encoded),
            spacer,
            italic(escape(ui.question)),
          ]),
          {
            parse_mode: parseMode,
            reply_markup: {
              force_reply: true,
              input_field_placeholder: ui.placeholder,
            },
          }
        );
      }],

      // Post a failure to create a reply
      failure: ['trade', async ({trade}) => {
        if (!trade.error) {
          return;
        }

        const [, message] = trade.error;

        return await ctx.reply(failure(message), failureMessage({}).actions);
      }],

      // Remove the referenced message
      remove: ['trade', async ({trade}) => {
        if (!!trade.error) {
          return;
        }

        return await ctx.deleteMessage();
      }],
    },
    returnResult({reject, resolve}, cbk));
  });
};
