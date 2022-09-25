const asyncAuto = require('async/auto');
const asyncMap = require('async/map');
const {getWalletInfo} = require('ln-service');
const {returnResult} = require('asyncjs-util');

const {checkAccess} = require('./../authentication');
const {icons} = require('./../interface');

const escape = text => text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\\$&');
const {isArray} = Array;
const join = arr => arr.join('\n');
const markup = {parse_mode: 'MarkdownV2'};
const replyMarkdownV1 = reply => n => reply(n, {parse_mode: 'Markdown'});

/** Get node info

  Syntax of command:

  /info

  {
    from: <Command From User Id Number>
    id: <Connected User Id Number>
    nodes: [{
      from: <From Name String>
      lnd: <Authenticated LND API Object>
      public_key: <Public Key Hex String>
    }]
    remove: <Remove Function>
    reply: <Reply Function>
  }
*/
module.exports = ({from, id, nodes, remove, reply}, cbk) => {
  return new Promise((resolve, reject) => {
    return asyncAuto({
      // Check arguments
      validate: cbk => {
        if (!from) {
          return cbk([400, 'ExpectedFromUserIdNumberForInfoCommand']);
        }

        if (!isArray(nodes)) {
          return cbk([400, 'ExpectedArrayOfNodesForInfoCommand']);
        }

        if (!remove) {
          return cbk([400, 'ExpectedRemoveFunctionForInfoCommand']);
        }

        if (!reply) {
          return cbk([400, 'ExpectedReplyFunctionForInfoCommand']);
        }

        return cbk();
      },

      // Authenticate the command caller is authorized to this command
      checkAccess: ['validate', ({}, cbk) => checkAccess({from, id}, cbk)],

      // Remove the invocation command
      remove: ['validate', async ({}) => await remove()],

      // Get wallet info
      getInfo: ['checkAccess', ({}, cbk) => {
        return asyncMap(nodes, ({lnd}, cbk) => getWalletInfo({lnd}, cbk), cbk);
      }],

      // Derive a summary of the wallet info
      summary: ['getInfo', ({getInfo}, cbk) => {
        const summary = getInfo.map(node => {
          const active = node.active_channels_count;
          const {alias} = node;
          const connected = node.peers_count;
          const {version} = node;

          const channels = active === 1 ? 'active channel' : 'active channels';
          const peers = connected === 1 ? 'peer' : 'peers';

          const elements = [
            `${icons.info} Info: ${escape(alias)} running ${escape(version)}`,
            `\`${node.public_key}\``,
            escape(`${active} ${channels} and ${connected} ${peers}.`),
            '',
          ];

          return join(elements);
        });

        return cbk(null, join(summary));
      }],

      // Send response to telegram
      reply: ['summary', async ({summary}) => {
        return await reply(summary, markup);
      }],
    },
    returnResult({reject, resolve}, cbk));
  });
};
