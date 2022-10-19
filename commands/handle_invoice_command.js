const asyncAuto = require('async/auto');
const fiat = require('@alexbosworth/fiat');
const {returnResult} = require('asyncjs-util');

const {checkAccess} = require('./../authentication');
const decodeTokens = require('./decode_tokens');
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
    request: <Request Function>
  }

  @returns via cbk or Promise
*/
module.exports = ({ctx, id, nodes, request}, cbk) => {
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

        if (!request) {
          return cbk([400, 'ExpectedRequestFunctionToCreateInvoice']);
        }

        return cbk();
      },

      // Parse tokens
      decodeTokens: ['validate', ({}, cbk) => {
        const [amount, ...description] = splitArguments(ctx.match.trim());

        return decodeTokens({
          request,
          tokens: amount,
        },
        cbk);
      }],

      // Confirm access authorization
      checkAccess: ['validate', ({}, cbk) => {
        return checkAccess({
          id,
          from: ctx.message.from.id,
        },
        cbk);
      }],

      // Decode passed command arguments
      decodeCommand: ['checkAccess', 'decodeTokens', async ({decodeTokens}) => {
        // Exit early when there are no arguments
        if (!!decodeTokens.error) {
          const failure = failureMessage({is_invalid_amount: true});

          return await ctx.reply(failure.message, failure.actions) && null;
        }

         // Exit early when the amount is fractional
        if (decodeTokens.is_fraction_error) {
          const failure = failureMessage({is_fractional_amount: true});

          return await ctx.reply(failure.message, failure.actions) && null;
        }

        if (!ctx.match) {
          return {description: defaultDescription, tokens: decodeTokens.tokens};
        }

        // The command can be called as /invoice <amount> <memo>
        const [amount, ...description] = splitArguments(ctx.match.trim());

        return {description: join(description), tokens: decodeTokens.tokens};
      }],

      // Remove the command message
      removeMessage: ['checkAccess', async ({}) => {
        try {
          return await ctx.deleteMessage();
        } catch (err) {
          // Do nothing on delete message errors
          return;
        }
      }],

      // Try to create the invoice
      create: ['decodeCommand', 'decodeTokens', ({decodeCommand, decodeTokens}, cbk) => {
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
          rate: decodeTokens.rate || undefined,
          tokens: decodeCommand.tokens,
        },
        cbk);
      }],
    },
    returnResult({reject, resolve}, cbk));
  });
};
