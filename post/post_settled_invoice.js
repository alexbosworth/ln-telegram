const asyncAuto = require('async/auto');
const {returnResult} = require('asyncjs-util');
const {subscribeToPastPayment} = require('ln-service');

const getRebalanceMessage = require('./get_rebalance_message');
const getReceivedMessage = require('./get_received_message');
const sendMessage = require('./send_message');

const earnEmoji = '💵';
const escape = text => text.replace(/[_[\]()~>#+\-=|{}.!\\]/g, '\\\$&');
const markdown = {parse_mode: 'MarkdownV2'};
const minQuizLength = 2;
const maxQuizLength = 10;
const randomIndex = n => Math.floor(Math.random() * n);
const rebalanceEmoji = '☯️';
/** Post settled invoices

  {
    from: <Invoice From Node String>
    id: <Connected User Id Number>
    invoice: {
      description: <Invoice Description String>
      id: <Invoice Preimage Hash Hex String>
      is_confirmed: <Invoice is Settled Bool>
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
    key: <Telegram API Key String>
    lnd: <Authenticated LND API Object>
    quiz: ({answers: [<String>], correct: <Number>, question: <String>}) => {}
    request: <Request Function>
  }

  @returns via cbk or Promise
*/
module.exports = ({api, from, id, invoice, lnd, quiz}, cbk) => {
  return new Promise((resolve, reject) => {
    return asyncAuto({
      // Check arguments
      validate: cbk => {
        if (!api) {
          return cbk([400, 'ExpectedTelegramApiObjectToPostSettledInvoice']);
        }

        if (!from) {
          return cbk([400, 'ExpectedFromNameToPostSettledInvoice']);
        }

        if (!id) {
          return cbk([400, 'ExpectedUserIdNumberToPostSettledInvoice']);
        }

        if (!invoice) {
          return cbk([400, 'ExpectedInvoiceToPostSettledInvoice']);
        }

        if (!lnd) {
          return cbk([400, 'ExpectedLndObjectToPostSettledInvoice']);
        }

        return cbk();
      },

      // Find associated payment
      getPayment: ['validate', ({}, cbk) => {
        // Exit early when the invoice has yet to be confirmed
        if (!invoice.is_confirmed) {
          return cbk();
        }

        const sub = subscribeToPastPayment({lnd, id: invoice.id});

        sub.once('confirmed', payment => cbk(null, {payment}));
        sub.once('error', () => cbk());
        sub.once('failed', () => cbk());

        return;
      }],

      // Details for message
      details: ['getPayment', ({getPayment}, cbk) => {
        // Exit early when the invoice has yet to be confirmed
        if (!invoice.is_confirmed) {
          return cbk();
        }

        // Exit early when this is a rebalance
        if (!!getPayment) {
          return getRebalanceMessage({
            lnd,
            fee: getPayment.payment.fee,
            hops: getPayment.payment.hops,
            payments: invoice.payments,
            received: invoice.received,
          },
          cbk);
        }

        return getReceivedMessage({
          lnd,
          description: invoice.description,
          payments: invoice.payments,
          received: invoice.received,
        },
        cbk);
      }],

      // Post invoice
      post: ['details', 'getPayment', async ({details, getPayment}) => {
        // Exit early when there is nothing to post
        if (!details) {
          return;
        }

        const emoji = !getPayment ? earnEmoji : rebalanceEmoji;

        const text = `${emoji} ${details.message} - ${from}`;

        return await api.sendMessage(id, escape(text), markdown);
      }],

      // Post quiz
      quiz: ['details', 'post', ({details, post}, cbk) => {
        // Exit early when there is no quiz
        if (!details || !details.quiz || details.quiz.length < minQuizLength) {
          return cbk();
        }

        // Exit early when the quiz has too many answers
        if (details.quiz.length > maxQuizLength) {
          return cbk();
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

        quiz({answers, correct, question: details.title});

        return cbk();
      }],
    },
    returnResult({reject, resolve}, cbk));
  });
};
