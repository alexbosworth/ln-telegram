const asyncAuto = require('async/auto');
const {getPeerLiquidity} = require('ln-sync');
const {returnResult} = require('asyncjs-util');


const detailsJoiner = ' ';
const escape = text => text.replace(/[_[\]()~>#+\-=|{}.!\\]/g, '\\\$&');
const markdown = {parse_mode: 'MarkdownV2'};
const textJoiner = '\n';
const tokensAsBigTok = tokens => (tokens / 1e8).toFixed(8);

/** Post a channel closed message for Telegram

  {
    capacity: <Closed Channel Capacity Tokens Number>
    from: <Node From String>
    id: <Connected Telegram User Id String>
    is_breach_close: <Is Breach Close Bool>
    is_cooperative_close: <Is Cooperative Close Bool>
    is_local_force_close: <Is Local Force Close Bool>
    is_remote_force_close: <Is Remote Force close Bool>
    key: <Telegram API Key String>
    lnd: <Authenticated LND API Object>
    partner_public_key: <Partner Public Key Hex String>
    request: <Request Function>
  }

  @returns via cbk or Promise
  {
    text: <Channel Close Message Text String>
  }
*/
module.exports = (args, cbk) => {
  return new Promise((resolve, reject) => {
    return asyncAuto({
      // Check arguments
      validate: cbk => {

        if (!args.api) {
          return cbk([400, 'ExpectedTelegramApiObjectToPostClosedMessage']);
        }

        if (args.capacity === undefined) {
          return cbk([400, 'ExpectedChannelCapacityToPostClosedMessage']);
        }

        if (!args.from) {
          return cbk([400, 'ExpectedFromNodeToPostClosedMessage']);
        }

        if (!args.id) {
          return cbk([400, 'ExpectedConnectedUserIdToPostClosedMessage'])
        }

        if (args.is_breach_close === undefined) {
          return cbk([400, 'ExpectedBreachCloseBoolToPostClosedMessage']);
        }

        if (args.is_cooperative_close === undefined) {
          return cbk([400, 'ExpectedCooperativeCloseBoolToPostClosedMessage']);
        }

        if (args.is_local_force_close === undefined) {
          return cbk([400, 'ExpectedLocalForceCloseStatusToPostCloseMessage']);
        }

        if (args.is_remote_force_close === undefined) {
          return cbk([400, 'ExpectedRemoteForceCloseToPostCloseMessage']);
        }

        if (!args.lnd) {
          return cbk([400, 'ExpectedAuthenticatedLndToPostCloseMessage']);
        }

        if (!args.partner_public_key) {
          return cbk([400, 'ExpectedPartnerPublicKeyToPostCloseMessage']);
        }

        return cbk();
      },

      // Event prefix
      event: ['validate', async ({}, cbk) => {
        const capacity = tokensAsBigTok(args.capacity);

        if (args.is_breach_close) {
          return `Breach countered on ${capacity} channel with`;
        } else if (args.is_cooperative_close) {
          return `Cooperatively closed ${capacity} channel with`;
        } else if (args.is_local_force_close) {
          return `Force-closed ${capacity} channel with`;
        } else if (args.is_remote_force_close) {
          return `${capacity} channel was force closed by`;
        } else {
          return `${capacity} channel closed with`;
        }
      }],

      // Get peer liquidity rundown
      getLiquidity: ['validate', ({}, cbk) => {
        return getPeerLiquidity({
          lnd: args.lnd,
          public_key: args.partner_public_key,
        },
        cbk);
      }],

      // Update text
      message: ['event', 'getLiquidity', ({event, getLiquidity}, cbk) => {
        const details = [
          `${event} ${getLiquidity.alias} ${args.partner_public_key}.`,
          `Inbound liquidity now: ${tokensAsBigTok(getLiquidity.inbound)}.`,
          `Outbound liquidity now: ${tokensAsBigTok(getLiquidity.outbound)}.`,
        ];

        const text = [`🥀 ${details.join(detailsJoiner)}`, args.from];

        return cbk(null, {text: text.join(textJoiner)});
      }],

      // Send channel closed message
      send: ['message', async ({message}) => {

        return await args.api.sendMessage(args.id, escape(message.text), markdown);
      }],
    },
    returnResult({reject, resolve, of: 'message'}, cbk));
  });
};
