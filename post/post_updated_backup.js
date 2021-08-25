const asyncAuto = require('async/auto');
const {returnResult} = require('asyncjs-util');

const date = () => new Date().toISOString().substring(0, 10);
const hexAsBuffer = hex => Buffer.from(hex, 'hex');

/** Post updated backup to Telegram

  {
    backup: <Backup File Hex String>
    id: <Connected User Id Number>
    key: <Telegram API Key String>
    node: {
      alias: <Node Alias String>
      public_key: <Public Key Hex String>
    }
    send: <Send File Function>
  }

  @returns via cbk or Promise
*/
module.exports = ({backup, id, key, node, send}, cbk) => {
  return new Promise((resolve, reject) => {
    return asyncAuto({
      // Check arguments
      validate: cbk => {
        if (!backup) {
          return cbk([400, 'ExpectedBackupFileToPostUpdatedBackup']);
        }

        if (!id) {
          return cbk([400, 'ExpectedIdToPostUpdatedBackup']);
        }

        if (!key) {
          return cbk([400, 'ExpectedApiKeyToPostUpdatedBackup']);
        }

        if (!node) {
          return cbk([400, 'ExpectedNodeToPostUpdatedBackup']);
        }

        if (!send) {
          return cbk([400, 'ExpectedSendFunctionToPostUpdatedBackup']);
        }

        return cbk();
      },

      // Post the backup file
      post: ['validate', ({}, cbk) => {
        const filename = `${date()}-${node.alias}-${node.public_key}.backup`;

        return (async () => {
          try {
            await send(id, {filename, source: hexAsBuffer(backup)});

            return cbk();
          } catch (err) {
            return cbk([503, 'UnexpectedErrorSendingBackupFileUpdate', {err}]);
          }
        })();
      }],
    },
    returnResult({reject, resolve}, cbk));
  });
};
