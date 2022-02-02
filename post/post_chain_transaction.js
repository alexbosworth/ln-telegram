const asyncAuto = require('async/auto');
const {returnResult} = require('asyncjs-util');

const sendMessage = require('./send_message');

const emoji = '⛓';
const tokAsBig = tokens => (tokens / 1e8).toFixed(8);

/** Post chain transaction

  {
    confirmed: <Transaction is Confirmed Bool>
    from: <From Node String>
    id: <Connected User Id Number>
    key: <Telegram API Key String>
    request: <Request Function>
    transaction: [{
      [chain_fee]: <Paid Transaction Fee Tokens Number>
      [received]: <Received Tokens Number>
      related_channels: [{
        action: <Channel Action String>
        [node]: <Channel Peer Alias String>
        [with]: <Channel Peer Public Key Hex String>
      }]
      [sent]: <Sent Tokens Number>
      [sent_to]: [<Sent to Address String>]
      [tx]: <Transaction Id Hex String>
    }]
  }

  @returns via cbk or Promise
*/
module.exports = ({confirmed, from, id, key, send, transaction}, cbk) => {
  return new Promise((resolve, reject) => {
    return asyncAuto({
      // Check arguments
      validate: cbk => {
        if (!from) {
          return cbk([400, 'ExpectedFromNodeFromToPostChainTransaction']);
        }

        if (!id) {
          return cbk([400, 'ExpectedConnectedUserIdToPostChainTransaction']);
        }

        if (!send) {
          return cbk([400, 'ExpectedSendToPostChainTransaction']);
        }

        if (!transaction) {
          return cbk([400, 'ExpectedTransactionRecordToPostChainTransaction']);
        }

        if (!transaction.related_channels) {
          return cbk([400, 'ExpectedRelatedChannelsInTransactionToPost']);
        }

        return cbk();
      },

      // Details of message
      details: ['validate', ({}, cbk) => {
        const chainFee = transaction.chain_fee;

        const fee = !!chainFee ? `Paid ${tokAsBig(chainFee)} fee` : '';

        const related = transaction.related_channels.map(related => {
          const alias = related.node || related.with || String();

          switch (related.action) {
          case 'channel_closing':
            return `Closing channel with ${alias}`;

          case 'cooperatively_closed_channel':
            return `Cooperatively closed with ${alias}`;

          case 'force_closed_channel':
            return `Force closed channel with ${alias}`;

          case 'opened_channel':
            return `Opened channel with ${alias}`;

          case 'opening_channel':
            return `Opening channel with ${alias}`;

          case 'peer_force_closed_channel':
            return `${alias} force closed channel`;

          case 'peer_force_closing_channel':
            return `${alias} force closing channel`;

          default:
            return String();
          }
        });

        const relatedChannels = related.filter(n => !!n).join('. ');

        // Exit early when the transaction is receiving
        if (!!transaction.received) {
          const elements = [
            `Received ${tokAsBig(transaction.received)}`,
            fee,
            !!relatedChannels.length ? `Related: ${relatedChannels}` : '',
          ];

          return cbk(null, elements.filter(n => !!n).join('. '));
        }

        // Exit early when the the transaction is sending
        if (!!transaction.sent) {
          const sentTo = transaction.sent_to;

          const elements = [
            `Sent ${tokAsBig(transaction.sent)}`,
            fee,
            !!sentTo ? `Sent to ${sentTo.join(', ')}` : '',
            !!relatedChannels.length ? `Related: ${relatedChannels}` : '',
          ];

          return cbk(null, elements.filter(n => !!n).join('. '));
        }

        return cbk();
      }],

      // Post message
      post: ['details', ({details}, cbk) => {
        if (!details) {
          return cbk();
        }

        const pending = !confirmed ? '(pending)' : '';

        const text = `${emoji} ${pending} ${details}\n${from}`;
        return (async () => {
          try {
            await send(id, text);
  
            return cbk();
          } catch (err) {
            return cbk([503, 'UnexpectedErrorPostingChainTransaction', {err}]);
          }
        })();
      }],
    },
    returnResult({reject, resolve}, cbk));
  });
};
