const asyncAuto = require('async/auto');
const {getBorderCharacters} = require('table');
const renderTable = require('table').table;
const {returnResult} = require('asyncjs-util');

const {checkAccess} = require('./../authentication');
const interaction = require('./../interaction');

const border = getBorderCharacters('void');
const feeAsRate = medianFee => `~${Math.ceil(medianFee)}/vByte`;
const fillRatio = vsize => Array(Math.ceil(vsize / 1e6 * 6)).fill('█');
const formatReport = n => `${interaction.mempool_report}\n\n\`\`\`${n}\`\`\``;
const header = ['Wait', 'Fee Rate', 'Filled'];
const {isArray} = Array;
const ok = 200;
const url = 'https://mempool.space/api/v1/fees/mempool-blocks';
const vbytesLimit = 1e6;
const virtualBlocksLimit = 6;
const waitTimeForBlock = n => `${n * 10} min`;

/** Handle the mempool command

  {
    from: <Command From User Id Number>
    id: <Connected User Id Number>
    reply: <Reply Function>
    request: <Request Function>
  }

  @returns via cbk or Promise
*/
module.exports = ({from, id, reply, request}, cbk) => {
  return new Promise((resolve, reject) => {
    return asyncAuto({
      // Check arguments
      validate: cbk => {
        if (!from) {
          return cbk([400, 'ExpectedFromUserIdNumberForMempoolCommand']);
        }

        if (!reply) {
          return cbk([400, 'ExpectedReplyFunctionToHandleMempoolCommand']);
        }

        if (!request) {
          return cbk([400, 'ExpectedRequestFunctionToHandleMempoolCommand']);
        }

        return cbk();
      },

      // Authenticate the command caller is authorized to this command
      checkAccess: ['validate', ({}, cbk) => {
        return checkAccess({from, id, reply}, cbk);
      }],

      // Get block data from mempool.space
      getMempool: ['checkAccess', ({}, cbk) => {
        reply(interaction.requesting_mempool);

        return request({url, json: true}, (err, r, mempool) => {
          if (!!err || !r || r.statusCode !== ok || !isArray(mempool)) {
            return cbk(null, {err: [503, 'ExpectedResponseFromMempoolSpace']});
          }

          return cbk(null, {mempool});
        });
      }],

      // Determine the reply to send to Telegram
      response: ['getMempool', ({getMempool}, cbk) => {
        if (getMempool.err) {
          return cbk(null, interaction.requesting_mempool_failed);
        }

        const blocks = getMempool.mempool
          .filter(block => block.blockVSize <= vbytesLimit)
          .slice(Number(), virtualBlocksLimit)
          .map((block, i) => {
            return [
              waitTimeForBlock(++i),
              feeAsRate(block.medianFee),
              fillRatio(block.blockVSize).join(String()),
            ];
          });

        const chart = renderTable([header].concat(blocks), {
          border,
          singleLine: true,
        });

        return cbk(null, formatReport(chart));
      }],

      // Send response to telegram
      reply: ['response', ({response}, cbk) => {
        reply(response);

        return cbk();
      }],
    },
    returnResult({reject, resolve}, cbk));
  });
};
