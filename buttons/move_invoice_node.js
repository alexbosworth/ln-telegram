const asyncAuto = require('async/auto');
const asyncReflect = require('async/reflect');
const {parsePaymentRequest} = require('ln-service');
const {returnResult} = require('asyncjs-util');

const {callbackCommands} = require('./../interface');
const {failureMessage} = require('./../messages');
const {postCreatedInvoice} = require('./../post');

const {isArray} = Array;
const {moveInvoiceNode} = callbackCommands;
const parseFailure = msg => `⚠️ Unexpected error \`${msg}\`. Try again?`;
const partialNodeId = data => data.slice(moveInvoiceNode.length);
const split = n => n.split('\n');

/** User pressed button to move invoice to a different node

  {
    ctx: <Telegram Context Object>
    nodes: [{
      from: <Saved Node Name String>
      lnd: <Authenticated LND API Object>
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
          return cbk([400, 'ExpectedTelegramContextToMoveInvoiceNode']);
        }

        if (!isArray(nodes)) {
          return cbk([400, 'ExpectedArrayOfNodesToMoveInvoiceNode']);
        }

        return cbk();
      },

      // Parse the message and get invoice details
      details: ['validate', asyncReflect(({}, cbk) => {
        const {data} = ctx.update.callback_query;
        const originalText = ctx.update.callback_query.message.text;

        const [, request] = split(originalText);

        // Make sure there is a payment request on the 2nd line
        if (!request) {
          return cbk([400, 'ExpectedPaymentRequestToMoveInvoiceNode']);
        }

        const node = nodes.find(node => {
          return node.public_key.startsWith(partialNodeId(data));
        });

        // Make sure the node that we are switching to is there
        if (!node) {
          return cbk([400, 'ExpectedKnownNodeToSwitchInvoiceTo']);
        }

        try {
          const details = parsePaymentRequest({request});

          return cbk(null, {
            description: details.description,
            destination: node.public_key,
            tokens: details.tokens,
          });
        } catch (err) {
          return cbk([400, 'ExpectedValidPaymentRequestToMoveInvoiceNode']);
        }
      })],

      // Remove the original message
      remove: ['validate', async ({}) => await ctx.deleteMessage()],

      // Stop the loading message
      respond: ['validate', async ({}) => await ctx.answerCallbackQuery()],

      // Post about a failure to parse payment request details
      failure: ['details', async ({details}) => {
        // Exit early when there was no parse failure
        if (!details.error) {
          return;
        }

        const [, msg] = details.error;

        return await ctx.reply(parseFailure(msg), failureMessage({}).actions);
      }],

      // Post the updated invoice
      post: ['details', ({details}, cbk) => {
        // Exit early when there was a parse failure and cannot move node
        if (!details.value) {
          return cbk();
        }

        return postCreatedInvoice({
          ctx,
          nodes,
          description: details.value.description,
          destination: details.value.destination,
          tokens: details.value.tokens,
        },
        cbk);
      }],
    },
    returnResult({reject, resolve}, cbk));
  });
};
