const asyncAuto = require('async/auto');
const asyncMap = require('async/map');
const {getNodeAlias} = require('ln-sync');
const {returnResult} = require('asyncjs-util');

const {icons} = require('./../interface');
const {formatTokens} = require('./../interface');

const elementJoiner = ' ';
const escape = text => text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\\$&');
const {isArray} = Array;
const markup = {parse_mode: 'MarkdownV2'};
const textJoiner = '\n';

/** Send channel opening message to telegram

  {
    from: <Node From Name String>
    id: <Connected Telegram User Id String>
    lnd: <Authenticated LND API Object>
    opening: [{
      capacity: <Channel Token Capacity Number>
      [is_partner_initiated]: <Channel Partner Opened Channel>
      partner_public_key: <Channel Partner Public Key String>
    }]
    send: <Send Message to Telegram User Id Function>
  }

  @returns via cbk or Promise
  {
    text: <Posted Channel Open Message String>
  }
*/
module.exports = ({from, id, lnd, opening, send}, cbk) => {
  return new Promise((resolve, reject) => {
    return asyncAuto({
      // Check arguments
      validate: cbk => {
        if (!from) {
          return cbk([400, 'ExpectedFromNameToPostChannelOpeningMessage']);
        }

        if (!id) {
          return cbk([400, 'ExpectedUserIdToPostChannelOpeningMessage']);
        }

        if (!lnd) {
          return cbk([400, 'ExpectedLndToPostChannelOpeningMessage']);
        }

        if (!isArray(opening)) {
          return cbk([400, 'ExpectedOpeningChannelsToPostChannelOpening']);
        }

        if (!send) {
          return cbk([400, 'ExpectedSendFunctionToPostChanOpeningMessage']);
        }

        return cbk();
      },

      // Get peer aliases
      getAliases: ['validate', ({}, cbk) => {
        return asyncMap(opening, (channel, cbk) => {
          return getNodeAlias({lnd, id: channel.partner_public_key}, cbk);
        },
        cbk);
      }],

      // Put together the message to summarize the channels opening
      message: ['getAliases', ({getAliases}, cbk) => {
        const lines = opening.map(chan => {
          const node = getAliases.find(n => n.id === chan.partner_public_key);

          const action = chan.is_partner_initiated ? 'Accepting' : 'Opening';
          const direction = !!chan.is_partner_initiated ? 'from' : 'to';
          const moniker = `${escape(node.alias)} \`${node.id}\``.trim();
          const isPrivate = chan.is_private ? `private 🌚` : undefined;
          
          const elements = [
            `${icons.opening} ${action} new`,
            escape(formatTokens({tokens: chan.capacity}).display),
            isPrivate,
            `channel ${direction} ${moniker}${escape('.')}`,
          ];

          return elements.join(elementJoiner);
        });

        const text = [lines.join(textJoiner), `_${escape(from)}_`];

        return cbk(null, {text: text.join(textJoiner)});
      }],

      // Send channel open message
      send: ['message', async ({message}) => {
        return await send(id, message.text, markup);
      }],
    },
    returnResult({reject, resolve, of: 'message'}, cbk));
  });
};
