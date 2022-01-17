const asyncAuto = require('async/auto');
const {getNetwork} = require('ln-sync');
const {returnResult} = require('asyncjs-util');

const {createTradeMessage} = require('./../messages');

const {isArray} = Array;

/** Post a created trade message and listen for incoming trade requests

  {
    api: <Telegram API Object>
    description: <Trade Description String>
    destination: <Trade Invoice Creator Public Key Hex String>
    expires_at: <Trade Expires at ISO 8601 Date String>
    id: <Trade Id Hex String>
    lnd: <Authenticated LND API Object>
    nodes: [{
      from: <Saved Node Name>
      public_key: <Public Key Hex String>
    }]
    tokens: <Trade Price Tokens Number>
    user: <Telegram User Id Number>
  }
*/
module.exports = (args, cbk) => {
  return new Promise((resolve, reject) => {
    return asyncAuto({
      // Check arguments
      validate: cbk => {
        if (!args.api) {
          return cbk([400, 'ExpectedTelegramApiObjectToPostCreatedTrade']);
        }

        if (args.description === undefined) {
          return cbk([400, 'ExpectedTradeDescriptionToPostCreatedTrade']);
        }

        if (!args.destination) {
          return cbk([400, 'ExpectedDestinationPublicKeyToPostCreatedTrade']);
        }

        if (!args.expires_at) {
          return cbk([400, 'ExpectedTradeExpiryToPostCreatedTrade']);
        }

        if (!args.id) {
          return cbk([400, 'ExpectedTradeIdToPostCreatedTrade']);
        }

        if (!args.lnd) {
          return cbk([400, 'ExpectedAuthenticatedLndToPostCreatedTrade']);
        }

        if (!isArray(args.nodes)) {
          return cbk([400, 'ExpectedArrayOfNodesToPostCreatedTrade']);
        }

        if (args.tokens === undefined) {
          return cbk([400, 'ExpectedTradePriceTokensToPostCreatedTrade']);
        }

        if (!args.user) {
          return cbk([400, 'ExpectedConnectedUserIdToPostCreatedTrade']);
        }

        return cbk();
      },

      // Get network name
      getNetwork: ['validate', ({}, cbk) => getNetwork({lnd: args.lnd}, cbk)],

      // Post the created trade to the user
      post: ['getNetwork', async ({getNetwork}) => {
        const node = args.nodes.find(n => n.public_key === args.destination);

        const [, other] = args.nodes;

        // Make the trade message text
        const message = createTradeMessage({
          description: args.description,
          expires_at: args.expires_at,
          from: !!other ? node.from : undefined,
          id: args.id,
          destination: args.destination,
          network: getNetwork.network,
          tokens: args.tokens,
        });

        // Post the new invoice as a message
        return await args.api.sendMessage(args.user, message.text, {
          parse_mode: message.mode,
          reply_markup: message.markup,
        });
      }],
    },
    returnResult({reject, resolve}, cbk));
  });
};
