const asyncAuto = require('async/auto');
const asyncReflect = require('async/reflect');
const {cancelHodlInvoice} = require('ln-service');
const {getInvoice} = require('ln-service');
const {parsePaymentRequest} = require('ln-service');
const {returnResult} = require('asyncjs-util');

const {callbackCommands} = require('./../interface');
const {failureMessage} = require('./../messages');
const interaction = require('./../interaction');
const {postCreatedInvoice} = require('./../post');

const {isArray} = Array;
const partialNodeId = (command, data) => data.slice(command.length);
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
        const command = callbackCommands.moveInvoiceNode;
        const {data} = ctx.update.callback_query;
        const originalText = ctx.update.callback_query.message.text;

        const [, request] = split(originalText);

        // Make sure there is a payment request on the 2nd line
        if (!request) {
          return cbk([400, 'ExpectedPaymentRequestToMoveInvoiceNode']);
        }

        const node = nodes.find(node => {
          return node.public_key.startsWith(partialNodeId(command, data));
        });

        // Make sure the node that we are switching to is there
        if (!node) {
          return cbk([400, 'ExpectedKnownNodeToSwitchInvoiceTo']);
        }

        try {
          parsePaymentRequest({request});
        } catch (err) {
          return cbk([400, 'ExpectedValidPaymentRequestToMoveInvoiceNode']);
        }

        const details = parsePaymentRequest({request});

        const original = nodes.find(n => n.public_key === details.destination);

        // Make sure the node that created the invoice is there to cancel it
        if (!original) {
          return cbk([400, 'ExpectedKnownNodeToSwitchInvoiceFrom']);
        }

        return cbk(null, {
          description: details.description,
          destination: node.public_key,
          id: details.id,
          lnd: original.lnd,
          tokens: details.tokens,
        });
      })],

      // Cancel the original invoice so that it can no longer be paid
      cancel: ['details', asyncReflect(({details}, cbk) => {
        // Exit early when there is no invoice to move
        if (!details.value) {
          return cbk();
        }

        return cancelHodlInvoice({
          id: details.value.id,
          lnd: details.value.lnd,
        },
        cbk);
      })],

      // Check if an invoice that could not be canceled was already paid
      getInvoice: [
        'cancel',
        'details',
        asyncReflect(({cancel, details}, cbk) =>
      {
        // Exit early when the invoice was canceled
        if (!cancel.error) {
          return cbk();
        }

        return getInvoice({id: details.value.id, lnd: details.value.lnd}, cbk);
      })],

      // Remove the original message once the original invoice is canceled
      remove: ['cancel', 'details', async ({cancel, details}) => {
        // Exit early to keep the message when the invoice is not moving
        if (!details.value || !!cancel.error) {
          return;
        }

        return await ctx.deleteMessage();
      }],

      // Stop the loading message
      respond: ['validate', async ({}) => await ctx.answerCallbackQuery()],

      // Post about a failure to parse the invoice or cancel it
      postFailure: [
        'cancel',
        'details',
        'getInvoice',
        async ({cancel, details, getInvoice}) =>
      {
        // Exit early when there was no failure
        if (!cancel.error && !details.error) {
          return;
        }

        // Exit early when the invoice cannot be moved because it was paid
        if (!!getInvoice.value && getInvoice.value.is_confirmed) {
          const paid = failureMessage({is_paid_invoice: true});

          return await ctx.reply(paid.message, paid.actions);
        }

        const [, code] = details.error || cancel.error;

        let text;

        // Trying again cannot help when a node is not connected
        switch (code) {
        case 'ExpectedKnownNodeToSwitchInvoiceFrom':
          text = interaction.move_invoice_missing_from_node;
          break;

        case 'ExpectedKnownNodeToSwitchInvoiceTo':
          text = interaction.move_invoice_missing_to_node;
          break;

        default:
          text = interaction.move_invoice_failed;
          break;
        }

        return await ctx.reply(text, failureMessage({}).actions);
      }],

      // Post the updated invoice
      post: ['cancel', 'details', ({cancel, details}, cbk) => {
        // Exit early when the original invoice cannot be moved
        if (!details.value || !!cancel.error) {
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
