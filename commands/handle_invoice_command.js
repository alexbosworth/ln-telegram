const asyncAuto = require('async/auto');
const {returnResult} = require('asyncjs-util');

const {checkAccess} = require('./../authentication');
const {failureMessage} = require('./../messages');
const {postCreatedInvoice} = require('./../post');

const defaultDescription = '';
const defaultTokens = '';
const {isArray} = Array;
const {isInteger} = Number;
const isNumber = n => !isNaN(n);
const join = n => n.join(' ');
const replyMarkdownV1 = reply => n => reply(n, {parse_mode: 'Markdown'});
const splitArguments = n => n.split(' ');

/** Create invoice

  {
    ctx: <Telegram Context Object>
    id: <Connected Id Number>
    nodes: [{
      from: <Node Name String>
      lnd: <Authenticated LND gRPC API Object>
    }]
  }

  @returns via cbk or Promise
*/
module.exports = ({ctx, id, nodes}, cbk) => {
  return new Promise((resolve, reject) => {
    return asyncAuto({
      // Check arguments
      validate: cbk => {
        if (!ctx) {
          return cbk([400, 'ExpectedTelegramMessageContextToCreateInvoice']);
        }

        if (!isArray(nodes) || !nodes.length) {
          return cbk([400, 'ExpectedArrayOfNodesToCreateInvoice']);
        }

        return cbk();
      },

      // Confirm access authorization
      checkAccess: ['validate', ({}, cbk) => {
        return checkAccess({
          id,
          from: ctx.message.from.id,
        },
        cbk);
      }],

      // Decode passed command arguments
      decodeCommand: ['checkAccess', async ({}) => {
        // Exit early when there are no arguments
        if (!ctx.match) {
          return {description: defaultDescription, tokens: defaultTokens};
        }

        // The command can be called as /invoice <amount> <memo>
        const [amount, ...description] = splitArguments(ctx.match.trim());

        // Exit early when the amount cannot be parsed as tokens
        if (!isNumber(amount)) {
          const failure = failureMessage({is_invalid_amount: true});

          return await ctx.reply(failure.message, failure.actions) && null;
        }

        // Exit early when the amount is fractional
        if (!isInteger(Number(amount))) {
          const failure = failureMessage({is_fractional_amount: true});

          return await ctx.reply(failure.message, failure.actions) && null;
        }

        return {description: join(description), tokens: Number(amount)};
      }],

      // Remove the command message
      removeMessage: ['checkAccess', async ({}) => await ctx.deleteMessage()],

      // Try to create the invoice
      create: ['decodeCommand', ({decodeCommand}, cbk) => {
        // Exit early when there is no decoded command
        if (!decodeCommand) {
          return cbk();
        }

        const [node] = nodes;

        return postCreatedInvoice({
          ctx,
          nodes,
          description: decodeCommand.description,
          destination: node.public_key,
          tokens: decodeCommand.tokens,
        },
        cbk);
      }],
    },
    returnResult({reject, resolve}, cbk));
  });
};
