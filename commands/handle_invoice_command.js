const asyncAuto = require('async/auto');
const asyncReflect = require('async/reflect');
const {returnResult} = require('asyncjs-util');

const {checkAccess} = require('./../authentication');
const {failureMessage} = require('./../messages');
const {getAmountAsTokens} = require('./../interface');
const {postCreatedInvoice} = require('./../post');

const defaultAmount = '';
const defaultDescription = '';
const {isArray} = Array;
const join = n => n.join(' ');
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

      // Confirm access authorization
      checkAccess: ['validate', ({}, cbk) => {
        return checkAccess({id, from: ctx.message.from.id}, cbk);
      }],

      // Decode passed command arguments
      decodeCommand: ['checkAccess', ({}, cbk) => {
        // Use the first node as the default
        const [node] = nodes;

        // Exit early when there are no arguments
        if (!ctx.match) {
          return cbk(null, {
            amount: defaultAmount,
            description: defaultDescription,
            destination: node.public_key,
            lnd: node.lnd,
          });
        }

        // The command can be called as /invoice <amount> <memo>
        const [amount, ...description] = splitArguments(ctx.match.trim());

        return cbk(null, {
          amount,
          description: join(description),
          destination: node.public_key,
          lnd: node.lnd,
        });
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

      // Get the amount as tokens for the invoice
      getTokens: ['decodeCommand', asyncReflect(({decodeCommand}, cbk) => {
        return getAmountAsTokens({
          request,
          amount: decodeCommand.amount,
          lnd: decodeCommand.lnd,
        },
        cbk);
      })],

      // Try to create the invoice
      create: [
        'decodeCommand',
        'getTokens',
        asyncReflect(({decodeCommand, getTokens}, cbk) =>
      {
        // Exit early when there was a problem getting the tokens value
        if (!!getTokens.error) {
          return cbk(getTokens.error);
        }

        return postCreatedInvoice({
          ctx,
          nodes,
          description: decodeCommand.description,
          destination: decodeCommand.destination,
          tokens: getTokens.value.tokens,
        },
        cbk);
      })],

      // Post a failure message when something went wrong
      postFailureMessage: ['create', async ({create}) => {
        // Exit early when there is no failure
        if (!create.error) {
          return;
        }

        const [, message] = create.error;

        const failure = failureMessage({});

        try {
          await ctx.reply(message, failure.actions);
        } catch (err) {
          // Ignore errors
        }
      }],
    },
    returnResult({reject, resolve}, cbk));
  });
};
