const asyncAuto = require('async/auto');
const asyncDetect = require('async/detect');
const asyncMap = require('async/map');
const {balancedOpenRequest} = require('paid-services');
const {getChannel} = require('ln-service');
const {getNodeAlias} = require('ln-sync');
const {returnResult} = require('asyncjs-util');
const {subscribeToPastPayment} = require('ln-service');

const getBalancedOpenMessage = require('./get_balanced_open_message');
const getRebalanceMessage = require('./get_rebalance_message');
const getReceivedMessage = require('./get_received_message');
const {icons} = require('./../interface');

const escape = text => text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\\$&');
const {isArray} = Array;
const minQuizLength = 2;
const maxQuizLength = 10;
const randomIndex = n => Math.floor(Math.random() * n);
const sendOptions = {parse_mode: 'MarkdownV2'};
const uniq = arr => Array.from(new Set(arr));

/** Post settled invoices

  {
    from: <Invoice From Node String>
    id: <Connected User Id Number>
    invoice: {
      description: <Invoice Description String>
      id: <Invoice Preimage Hash Hex String>
      is_confirmed: <Invoice is Settled Bool>
      [min_rebalance_tokens]: <Minimum Rebalance Tokens To Notify Number>
      payments: [{
        [confirmed_at]: <Payment Settled At ISO 8601 Date String>
        created_at: <Payment Held Since ISO 860 Date String>
        created_height: <Payment Held Since Block Height Number>
        in_channel: <Incoming Payment Through Channel Id String>
        is_canceled: <Payment is Canceled Bool>
        is_confirmed: <Payment is Confirmed Bool>
        is_held: <Payment is Held Bool>
        messages: [{
          type: <Message Type Number String>
          value: <Raw Value Hex String>
        }]
        mtokens: <Incoming Payment Millitokens String>
        [pending_index]: <Pending Payment Channel HTLC Index Number>
        tokens: <Payment Tokens Number>
        [total_mtokens]: <Total Payment Millitokens String>
      }]
      received: <Received Tokens Number>
    }
    key: <Node Public Key Id Hex String>
    lnd: <Authenticated LND API Object>
    nodes: [{
      from: <From Node String>
      lnd: <Authenticated LND API Object>
      public_key: <Node Identity Public Key Hex String>
    }]
    quiz: ({answers: [<String>], correct: <Number>, question: <String>}) => {}
    send: <Send Message Function> (id, message, options) => {}
  }

  @returns via cbk or Promise
*/
module.exports = (args, cbk) => {
  return new Promise((resolve, reject) => {
    return asyncAuto({
      // Check arguments
      validate: cbk => {
        if (!args.from) {
          return cbk([400, 'ExpectedFromNameToPostSettledInvoice']);
        }

        if (!args.id) {
          return cbk([400, 'ExpectedUserIdNumberToPostSettledInvoice']);
        }

        if (!args.invoice) {
          return cbk([400, 'ExpectedInvoiceToPostSettledInvoice']);
        }

        if (!args.key) {
          return cbk([400, 'ExpectedNodeIdentityKeyToPostSettledInvoice']);
        }

        if (!args.lnd) {
          return cbk([400, 'ExpectedLndObjectToPostSettledInvoice']);
        }

        if (!isArray(args.nodes)) {
          return cbk([400, 'ExpectedArrayOfNodesToPostSettledInvoice']);
        }

        if (!args.quiz) {
          return cbk([400, 'ExpectedSendQuizFunctionToPostSettledInvoice']);
        }

        if (!args.send) {
          return cbk([400, 'ExpectedSendFunctionToPostSettledInvoice']);
        }

        return cbk();
      },

      // Parse balanced open request details if present
      balancedOpen: ['validate', ({}, cbk) => {
        // A proposal will be a push payment
        if (!args.invoice.is_confirmed) {
          return cbk();
        }

        const {proposal} = balancedOpenRequest({
          confirmed_at: args.invoice.confirmed_at,
          is_push: args.invoice.is_push,
          payments: args.invoice.payments,
          received_mtokens: args.invoice.received_mtokens,
        });

        return cbk(null, proposal);
      }],

      // Get the node aliases that forwarded this
      getNodes: ['validate', ({}, cbk) => {
        const inChannels = uniq(args.invoice.payments.map(n => n.in_channel));

        return asyncMap(inChannels, (id, cbk) => {
          return getChannel({id, lnd: args.lnd}, (err, res) => {
            if (!!err) {
              return cbk(null, {id, alias: id});
            }

            const peer = res.policies.find(n => n.public_key !== args.key);

            return getNodeAlias({id: peer.public_key, lnd: args.lnd}, cbk);
          });
        },
        cbk);
      }],

      // Find associated payment
      getPayment: ['validate', ({}, cbk) => {
        // Exit early when the invoice has yet to be confirmed
        if (!args.invoice.is_confirmed) {
          return cbk();
        }

        const sub = subscribeToPastPayment({id: args.invoice.id, lnd: args.lnd});

        sub.once('confirmed', payment => cbk(null, {payment}));
        sub.once('error', () => cbk());
        sub.once('failed', () => cbk());

        return;
      }],

      // Find associated transfer
      getTransfer: ['validate', ({}, cbk) => {
        // Exit early when the invoice has yet to be confirmed
        if (!args.invoice.is_confirmed) {
          return cbk();
        }

        const otherNodes = args.nodes.filter(n => n.public_key !== args.key);

        return asyncDetect(otherNodes, ({lnd}, cbk) => {
          const sub = subscribeToPastPayment({lnd, id: args.invoice.id});

          sub.once('confirmed', payment => cbk(null, true));
          sub.once('error', () => cbk(null, false));
          sub.once('failed', () => cbk(null, false));
        },
        cbk);
      }],

      // Details for message
      details: [
        'balancedOpen',
        'getNodes',
        'getPayment',
        'getTransfer',
        ({balancedOpen, getNodes, getPayment, getTransfer}, cbk) =>
      {
        // Exit early when the invoice has yet to be confirmed
        if (!args.invoice.is_confirmed) {
          return cbk();
        }

        // Exit early when this is a node to node transfer
        if (!!getTransfer) {
          return cbk();
        }

        // Exit early when this is a balanced open
        if (!!balancedOpen) {
          return getBalancedOpenMessage({
            capacity: balancedOpen.capacity,
            from: balancedOpen.partner_public_key,
            lnd: args.lnd,
            rate: balancedOpen.fee_rate,
          },
          cbk);
        }

        // Exit early when this is a rebalance
        if (!!getPayment) {
          if (args.invoice.received < args.min_rebalance_tokens) {
            return cbk();
          }

          return getRebalanceMessage({
            fee_mtokens: getPayment.payment.fee_mtokens,
            hops: getPayment.payment.hops,
            lnd: args.lnd,
            payments: args.invoice.payments,
            received_mtokens: args.invoice.received_mtokens,
          },
          cbk);
        }

        return getReceivedMessage({
          description: args.invoice.description,
          lnd: args.lnd,
          payments: args.invoice.payments,
          received: args.invoice.received,
          via: getNodes,
        },
        cbk);
      }],

      // Post invoice
      post: ['details', 'getPayment', async ({details, getPayment}) => {
        // Exit early when there is nothing to post
        if (!details) {
          return;
        }

        const receivedOnNode = args.nodes.length > [args.key].length ? ` - ${args.from}` : '';
        const text = `${details.icon} ${details.message}`;

        return await args.send(args.id, `${text}${escape(receivedOnNode)}`, sendOptions);
      }],

      // Post quiz
      quiz: ['details', 'post', async ({details, post}) => {
        // Exit early when there is no quiz
        if (!details || !details.quiz || details.quiz.length < minQuizLength) {
          return;
        }

        // Exit early when the quiz has too many answers
        if (details.quiz.length > maxQuizLength) {
          return;
        }

        const [answer] = details.quiz;
        const correct = randomIndex(details.quiz.length);

        const replace = details.quiz[correct];

        // Randomize the position of the correct answer
        const answers = details.quiz.map((n, i) => {
          if (i === correct) {
            return answer;
          }

          if (!i) {
            return replace;
          }

          return n;
        });

        return await args.quiz({answers, correct, question: details.title});
      }],
    },
    returnResult({reject, resolve}, cbk));
  });
};
