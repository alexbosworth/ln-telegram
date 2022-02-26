const asyncAuto = require('async/auto');
const asyncMap = require('async/map');
const asyncReflect = require('async/reflect');
const {findKey} = require('ln-sync');
const {formatTokens} = require('ln-sync');
const {getNode} = require('ln-service');
const {parsePaymentRequest} = require('ln-service');
const {returnResult} = require('asyncjs-util');

const {checkAccess} = require('./../authentication');
const {icons} = require('./../interface');
const {makeRemoveButton} = require('./../buttons');

const {isArray} = Array;

const argsFromText = text => text.split(' ');
const bigType = 'large_channels';
const escape = text => text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\\$&');
const expectedQueryErrorMessage = 'ExpectedQueryForGraphCommand';
const ipv4Match = /^((25[0-5]|(2[0-4]|1\d|[1-9]|)\d)(\.(?!$)|$)){4}$/;
const ipv6Match = /^[a-fA-F0-9:]+$/;
const markup = {parse_mode: 'MarkdownV2'};
const noQueryMsg = 'Missing graph query, try `/graph (public key/peer alias)`';
const notFoundCode = 404;
const notFoundMsg = query => `\`${query}\` not found\\\. Wrong public key?`;
const replyMarkdownV1 = reply => n => reply(n, {parse_mode: 'Markdown'});
const sanitize = n => (n || '').replace(/_/g, '\\_').replace(/[*~`]/g, '');
const shortKey = key => key.substring(0, 16);
const socketHost = n => n.split(':').slice(0, -1).join(':');
const sumOf = arr => arr.reduce((sum, n) => sum + n, 0);
const tokensAsBigTokens = tokens => (tokens / 1e8).toFixed(8);
const torV3Match = /[a-z2-7]{56}.onion/i;
const uniq = arr => Array.from(new Set(arr));

/** Get details about a node in the graph

  Syntax of command:

  /graph <pubkey>

  {
    from: <Command From User Id Number>
    id: <Connected User Id Number>
    nodes: [{
      from: <From Name String>
      lnd: <Authenticated LND API Object>
      public_key: <Public Key Hex String>
    }]
    reply: <Reply Function>
    text: <Original Command Text String>
    working: <Working Function>
  }
*/
module.exports = ({from, id, nodes, remove, reply, text, working}, cbk) => {
  return new Promise((resolve, reject) => {
    return asyncAuto({
      // Check arguments
      validate: cbk => {
        if (!from) {
          return cbk([400, 'ExpectedFromUserIdNumberForGraphCommand']);
        }

        if (!isArray(nodes)) {
          return cbk([400, 'ExpectedNodesForGraphCommand']);
        }

        if (!reply) {
          return cbk([400, 'ExpectedReplyFunctionForGraphCommand']);
        }

        if (!text) {
          return cbk([400, 'ExpectedOriginalCommandTextForGraphCommand']);
        }

        if (!working) {
          return cbk([400, 'ExpectedWorkingFunctionForGraphCommand']);
        }

        return cbk();
      },

      // Authenticate that the caller is authorized to call this command
      checkAccess: ['validate', ({}, cbk) => {
        return checkAccess({from, id, reply: replyMarkdownV1(reply)}, cbk);
      }],

      // Remove the query
      remove: ['checkAccess', async ({}) => await remove()],

      // Derive the public key query if present
      query: ['checkAccess', ({}, cbk) => {
        const [, query] = argsFromText(text);

        // Check if a payment request was entered
        try {
          const {destination} = parsePaymentRequest({request: query});

          return cbk(null, destination);
        } catch (err) {
          // Ignore errors
        }

        return cbk(null, query);
      }],

      // Send indication that the graph command has started working
      init: ['query', async ({}) => await working()],

      // Get public key filter
      getKey: ['query', asyncReflect(({query}, cbk) => {
        if (!query) {
          return cbk([400, expectedQueryErrorMessage]);
        }

        // Look for a match
        return asyncMap(nodes, ({lnd}, cbk) => {
          return findKey({lnd, query}, (err, res) => {
            if (!!err) {
              return cbk(null, {});
            }

            return cbk(null, {lnd, id: res.public_key});
          });
        },
        cbk);
      })],

      // Get node info, exit early if one saved node returns data
      getNodeInfo: ['query', 'getKey', asyncReflect(({query, getKey}, cbk) => {
        // Exit early when there is no get key result
        if (!!getKey.error) {
          return cbk();
        }

        const [node] = getKey.value.filter(n => !!n.id);

        if (!node) {
          return cbk([404, 'FailedToFindMatchingNodeForQuery']);
        }

        return getNode({lnd: node.lnd, public_key: node.id}, (err, res) => {
          if (!!err) {
            return cbk(err);
          }

          const keys = res.channels.map(({policies}) => {
            return policies.find(n => n.public_key !== node.id).public_key;
          });

          const isMissingCapacity = !!res.channels.find(n => !n.capacity);

          return cbk(null, {
            alias: res.alias,
            capacity: !isMissingCapacity ? res.capacity : undefined,
            features: res.features,
            id: node.id,
            peer_count: uniq(keys).length,
            sockets: res.sockets.map(n => n.socket),
          });
        });
      })],

      // Put together the fetched node info into a concise summary of the node
      summary: ['getNodeInfo', ({getNodeInfo}, cbk) => {
        // Exit early when there is no node info
        if (!getNodeInfo.value) {
          return cbk();
        }

        const node = getNodeInfo.value;

        const capacity = `${tokensAsBigTokens(node.capacity)} capacity `;
        const isBig = !!node.features.find(n => n.type === bigType);
        const isIpV4 = !!node.sockets.find(n => ipv4Match.test(socketHost(n)));
        const isIpV6 = !!node.sockets.find(n => ipv6Match.test(socketHost(n)));
        const isTor = !!node.sockets.find(n => torV3Match.test(socketHost(n)));

        const isClearnet = isIpV4 || isIpV6;

        const isUnconnectable = !isClearnet && !isTor;

        const [connection] = [
          isUnconnectable ? `They do not publish any network address.` : '',
          !isClearnet && isTor ? 'Only Tor connections are supported.' : '',
          isClearnet ? 'Clearnet connections are accepted.' : '',
        ].filter(n => !!n);


        const summary = [
          `A ${!!node.capacity ? escape(capacity) : ''}node`,
          ` with ${node.peer_count} peer${node.peer_count > 1 ? 's' : ''}`,
          isBig ? ' that accepts large channels' : '',
          escape('.'),
          !!connection ? ` ${escape(connection)}` : '',
        ];

        const report = [
          `Node: *${escape(node.alias) || shortKey(node.id)}* \`${node.id}\``,
          summary.filter(n => !!n).join(''),
        ];

        return cbk(null, report.join('\n'));
      }],

      // Send a failure message
      sendFailure: [
        'getKey',
        'getNodeInfo',
        'query',
        async ({getKey, getNodeInfo, query}) =>
      {
        // Exit early when there is no failure to send
        if (!getKey.error && !getNodeInfo.error) {
          return;
        }

        const [code, msg] = getKey.error || getNodeInfo.error;
        const icon = icons.bot;
        const parseMode = markup.parse_mode;
        const removeButton = makeRemoveButton({}).markup;

        const options = {parse_mode: parseMode, reply_markup: removeButton};

        // Exit early when the user entered a public key that can't be found
        if (code === notFoundCode) {
          const entry = escape(query);

          return await reply(`${icon} ${notFoundMsg(entry)}`, options);
        }

        // Exit early when the user entered no query message at all
        if (msg === expectedQueryErrorMessage) {
          return await reply(`${icon} ${noQueryMsg}`, options);
        }

        // Return the unexpected failure message
        const message = `${icon} Failed to find match: \`${escape(msg)}\``;

        return await reply(message, options);
      }],

      // Send the summary response
      sendSuccess: ['summary', async ({summary}) => {
        // Exit early when there is no summary to send
        if (!summary) {
          return;
        }

        return await reply(summary, markup);
      }],
    },
    returnResult({reject, resolve}, cbk));
  });
};
