const asyncAuto = require('async/auto');
const {getPeerLiquidity} = require('ln-sync');
const {returnResult} = require('asyncjs-util');

const detailsJoiner = ' ';
const escape = text => text.replace(/[_[\]()~>#+\-=|{}.!\\]/g, '\\\$&');
const markdown = {parse_mode: 'MarkdownV2'};
const textJoiner = '\n';
const tokensAsBigTok = tokens => (tokens / 1e8).toFixed(8);

/** Send channel open message to telegram

  {
    capacity: <Channel Token Capacity Number>
    from: <Node From Name String>
    id: <Connected Telegram User Id String>
    [is_partner_initiated]: <Channel Partner Opened Channel>
    is_private: <Channel Is Private Bool>
    key: <Telegram API Key String>
    lnd: <Authenticated LND gRPC API Object>
    partner_public_key: <Channel Partner Public Key String>
    request: <Request Function>
  }

  @returns via cbk or Promise
  {
    text: <Posted Channel Open Message String>
  }
*/
module.exports = (args, cbk) => {
  return new Promise((resolve, reject) => {
    return asyncAuto({
      // Check arguments
      validate: cbk => {
        if (!args.api) {
          return cbk([400, 'ExpectedTelegramApiObjectToPostChannelOpenMessage']);
        }

        if (args.capacity === undefined) {
          return cbk([400, 'ExpectedCapacityToPostChannelOpenMessage']);
        }

        if (!args.from) {
          return cbk([400, 'ExpectedFromNameToPostChannelOpenMessage']);
        }

        if (!args.id) {
          return cbk([400, 'ExpectedTelegramUserIdToPostChannelOpenMessage']);
        }

        if (args.is_private === undefined) {
          return cbk([400, 'ExpectedPrivateStatusToPostChannelOpenMessage']);
        }

        if (!args.lnd) {
          return cbk([400, 'ExpectedLndToPostChannelOpenMessage']);
        }

        if (!args.partner_public_key) {
          return cbk([400, 'ExpectedPartnerPublicKeyToPostChanOpenMessage']);
        }

        return cbk();
      },

      // Get peer liquidity rundown
      getLiquidity: ['validate', ({}, cbk) => {
        return getPeerLiquidity({
          lnd: args.lnd,
          public_key: args.partner_public_key,
        },
        cbk);
      }],

      // Message text
      message: ['getLiquidity', ({getLiquidity}, cbk) => {
        const action = args.is_partner_initiated ? 'Accepted' : 'Opened';
        const capacity = tokensAsBigTok(args.capacity);
        const channel = args.is_private ? 'private channel' : 'channel';
        const direction = !!args.is_partner_initiated ? 'from' : 'to';
        const moniker = `${getLiquidity.alias} ${args.partner_public_key}`;

        const event = `${action} new ${capacity} ${channel}`;

        const details = [
          `${event} ${direction} ${moniker}.`,
          `Inbound liquidity now: ${tokensAsBigTok(getLiquidity.inbound)}.`,
          `Outbound liquidity now: ${tokensAsBigTok(getLiquidity.outbound)}.`,
        ];

        const text = [`🌹 ${details.join(detailsJoiner)}`, args.from];

        return cbk(null, {text: text.join(textJoiner)});
      }],

      // Send channel open message
      send: ['message', async ({message}) => {

        return await args.api.sendMessage(args.id, escape(message.text), markdown);
      }],
    },
    returnResult({reject, resolve, of: 'message'}, cbk));
  });
};
