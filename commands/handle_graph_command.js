const asyncAuto = require('async/auto');
const asyncMap = require('async/map');
const asyncEach = require('async/each');
const {findKey} = require('ln-sync');
const {formatTokens} = require('ln-sync');
const {getChannel} = require('ln-service');
const {getChannels} = require('ln-service');
const {getNode} = require('ln-service');
const {returnResult} = require('asyncjs-util');
const {getBorderCharacters} = require('table');
const renderTable = require('table').table;

const {checkAccess} = require('./../authentication');
const interaction = require('./../interaction');

const {isArray} = Array;
const border = getBorderCharacters('void');
const header = ['*Sockets:*'];

const isPublicKey = n => !!n && /^0[2-3][0-9A-F]{64}$/i.test(n);
const ipv4Match = /^((25[0-5]|(2[0-4]|1\d|[1-9]|)\d)(\.(?!$)|$)){4}$/;
const ipv6Match = /^[a-fA-F0-9:]+$/;
const nodeCapacity = tokens => Number((formatTokens({tokens, is_monochrome: true}).display)).toFixed(3);
const peerTitle = (query, k) => `🌊 Liquidity with *${query} ${k}:*`;
const sanitize = n => (n || '').replace(/_/g, '\\_').replace(/[*~`]/g, '');
const short = key => key.substring(0, 8);
const torV3Match = /[a-z2-7]{56}.onion/i;
const uniq = arr => Array.from(new Set(arr));
const join = arr => arr.filter(n => !!n).join('\n');



/** Check peer liquidity

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
module.exports = (args, cbk) => {
  return new Promise((resolve, reject) => {
    return asyncAuto({
      // Check arguments
      validate: cbk => {
        if (!args.from) {
          return cbk([400, 'ExpectedFromUserIdNumberForGraphCommand']);
        }

        if (!args.id) {
          return cbk([400, 'ExpectedConnectedIdNumberForGraphCommand']);
        }

        if (!isArray(args.nodes)) {
          return cbk([400, 'ExpectedNodesForGraphCommand']);
        }

        if (!args.reply) {
          return cbk([400, 'ExpectedReplyFunctionForGraphCommand']);
        }

        if (!args.text) {
          return cbk([400, 'ExpectedOriginalCommandTextForGraphCommand']);
        }

        if (!args.working) {
          return cbk([400, 'ExpectedWorkingFunctionForGraphCommand']);
        }

        return cbk();
      },

      // Authenticate the command caller is authorized to this command
      checkAccess: ['validate', ({}, cbk) => {
        return checkAccess({
          from: args.from,
          id: args.id,
          reply: args.reply,
        },
        cbk);
      }],

      // Derive the public key query if present
      query: ['checkAccess', ({}, cbk) => {
        const [, query] = args.text.split(' ');

        return cbk(null, query);
      }],

      // Get public key filter
      getKey: ['query', ({query}, cbk) => {
        if (!query) {
          args.reply('Invalid Query');

          return cbk([400, 'ExpectedQueryForGraphCommand']);
        }

        args.working();

        return asyncMap(args.nodes, (node, cbk) => {
          return findKey({
            query,
            lnd: node.lnd,
          },
          (err, found) => {
            if (!!err) {
              return cbk();
            }

            return cbk(null, found.public_key);
            });
        },
        cbk);
      }],

      //Get node info, exit early if one saved node returns data
      getNodeInfo: ['query', 'getKey', ({query, getKey}, cbk) => {
        //Exit early if there are no pubkeys
        if (!getKey || !getKey.length) {
          args.reply(interaction.node_not_found);

          return cbk([400, 'NodeNotFoundForGraphCommand']);
        }
        const key = getKey.find(n => !!n);
        //Exit early if no key is found
        if (!key) {
          args.reply(interaction.node_not_found);

          return cbk([400, 'NodeNotFoundForGraphCommand']);
        }
        //Get the node info
        return asyncMap(args.nodes, (node, cbk) => {
          getNode({
            lnd: node.lnd,
            public_key: key,
          },
          (err, res) => {
            if (!!err) {
              return cbk(err);
            }
            return cbk(null, {res, key});
  
          });
        },
        cbk);
      }], 

      //Get node info, exit early if one saved node returns data
      getPeerPubkeys: ['getNodeInfo', ({getNodeInfo}, cbk) => {
        const [info] = getNodeInfo;
        //Exit early if no info
        if (!info) {
          args.reply(interaction.node_not_found);

          return cbk([400, 'NodeNotFound']);
        }

        const publickeys = [];
        //Get peer public keys associated with all channels
        info.res.channels.forEach(channel => {

          channel.policies.forEach(policy => {
            
            if (policy.public_key !== info.key) {
              publickeys.push(policy.public_key);
            }
          })
        });
        //Remove duplicates pubkeys
        const uniquePubkeys = [...new Set(publickeys)];

        return cbk(null, uniquePubkeys);
      }], 
      
      graph: [
      'getNodeInfo',
      'getPeerPubkeys',
      ({
        getNodeInfo,
        getPeerPubkeys,
      }, 
      cbk) => {
        try {
          const [info] = getNodeInfo;

          const findFeature = info.res.features.find(feature => feature.type === 'large_channels');

          const {alias, capacity, sockets} = info.res;
          //Construct response
          const response = {
            alias,
            capacity: `${nodeCapacity(capacity)} BTC`,
            is_accepting_large_channels: !!findFeature ? true : false,
            is_onion: false,
            is_clearnet: false,
            peer_count: getPeerPubkeys.length || Number(0),
            pubkey: info.key,
          };
          //Get sockets check for onion/clearnet
          sockets.forEach(socket => {
          const [port, ...host] = socket.socket.split(':').reverse();
          const hostName = host.reverse().join(':');

          if (ipv4Match.test(hostName) || ipv6Match.test(hostName)) {
            response.is_clearnet = true;
          }

          if (torV3Match.test(hostName)) {
            response.is_onion = true;
          }
          });
          //Build the message
          const text = join([
            `*${response.alias}*`,
            `\`${response.pubkey}\`\n`,
            `is a *${response.capacity}* node with *${response.peer_count}* peers and *${response.is_accepting_large_channels ? 'accepts' : 'does not accept'}* large channels.\n`,
            `*${!!response.is_onion && !!response.is_clearnet ? '🧅 Onion and 🌐 Clearnet' : (!!response.is_onion? '🧅 Onion': '🌐 Clearnet')}* connections accepted.`,
          ]);

          return cbk(null, text);
        } catch (err) {
        return cbk([400, 'ErrorConstructingResponseForGraphCommand']);
        }
      }],

      // Send the response
      send: ['graph', ({graph}, cbk) => {
        args.reply(graph);

        return cbk();
      }],

    },
    returnResult({reject, resolve}, cbk));
  });
};
