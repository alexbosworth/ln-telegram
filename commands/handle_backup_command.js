const asyncAuto = require('async/auto');
const asyncEach = require('async/each');
const {getBackups} = require('ln-service');
const {returnResult} = require('asyncjs-util');

const {checkAccess} = require('./../authentication');
const {sendFile} = require('./../post');

const date = () => new Date().toISOString().substring(0, 10);
const hexAsBuffer = hex => Buffer.from(hex, 'hex');
const {isArray} = Array;

/** Execute backup command

  {
    from: <Command From User Id Number>
    id: <Connected User Id Number>
    key: <Telegram API Key String>
    nodes: [{
      alias: <Node Alias String>
      lnd: <Authenticated LND gRPC API Object>
      public_key: <Node Public Key Hex String>
    }]
    reply: <Reply Function>
    send: <Send Document Function>
  }

  @returns via cbk or Promise
*/
module.exports = (args, cbk) => {
  return new Promise((resolve, reject) => {
    return asyncAuto({
      // Check arguments
      validate: cbk => {
        if (!args.from) {
          return cbk([400, 'ExpectedFromUserIdToExecuteBackupCommand']);
        }

        if (!args.id) {
          return cbk([400, 'ExpectedConnectedUserIdToExecuteBackupCommand']);
        }

        if (!args.key) {
          return cbk([400, 'ExpectedTelegramApiKeyToExecuteBackupCommand']);
        }

        if (!args.logger) {
          return cbk([400, 'ExpectedLoggerToExecuteBackupCommand']);
        }

        if (!isArray(args.nodes)) {
          return cbk([400, 'ExpectedNodesArrayToExecuteBackupCommand']);
        }

        if (!args.reply) {
          return cbk([400, 'ExpectedReplyFunctionToExecuteBackupCommand']);
        }

        if (!args.send) {
          return cbk([[400, 'ExpectedSendDocumentFunctionToHandleBackupCmd']]);
        }

        return cbk();
      },

      // Check access
      checkAccess: ['validate', ({}, cbk) => {
        return checkAccess({
          from: args.from,
          id: args.id,
          reply: args.reply,
        },
        cbk);
      }],

      // Get backups and send them as documents
      getBackups: ['checkAccess', ({}, cbk) => {
        return asyncEach(args.nodes, (node, cbk) => {
          return getBackups({lnd: node.lnd}, async (err, res) => {
            if (!!err) {
              return cbk(err);
            }

            const filename = `${date()}-${node.alias}-${node.public_key}`;

            try {
              await args.send({
                filename: `${filename}.backup`,
                source: hexAsBuffer(res.backup),
              });
            } catch (err) {
              args.logger.error({err});
            } finally {
              return cbk();
            }
          });
        },
        cbk);
      }],
    },
    returnResult({reject, resolve}, cbk));
  });
};
