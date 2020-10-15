const asyncAuto = require('async/auto');
const {returnResult} = require('asyncjs-util');

const sendFile = require('./send_file');

const date = () => new Date().toISOString().substring(0, 10);

/** Post updated backup to Telegram

  {
    backup: <Backup File Hex String>
    id: <Connected User Id Number>
    key: <Telegram API Key String>
    node: {
      alias: <Node Alias String>
      public_key: <Public Key Hex String>
    }
    request: <Request Function>
  }

  @returns via cbk or Promise
*/
module.exports = ({backup, id, key, node, request}, cbk) => {
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

        if (!request) {
          return cbk([400, 'ExpectedRequestFunctionToPostUpdatedBackup']);
        }

        return cbk();
      },

      // Post the backup file
      post: ['validate', ({}, cbk) => {
        const filename = `${date()}-${node.alias}-${node.public_key}.backup`;
        const hex = backup;

        return sendFile({filename, hex, id, key, request}, cbk);
      }],
    },
    returnResult({reject, resolve}, cbk));
  });
};
