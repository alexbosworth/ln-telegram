const asyncAuto = require('async/auto');
const {returnResult} = require('asyncjs-util');

const {bot} = require('./../interaction');
const {checkAccess} = require('./../authentication');

const failedToGetVersion = `${bot} Failed to get version information from NPM`;
const currentVersion = n => `${bot} Running version: ${n}`;
const latestVersion = n => `${bot} Latest version: ${n}`;
const ok = 200;
const url = n => `https://registry.npmjs.org/${n}/latest`;

/** Handle the mempool command

  {
    from: <Command From User Id Number>
    id: <Connected User Id Number>
    named: <Name To Look Up String>
    reply: <Reply Function>
    request: <Request Function>
    version: <Current Version String>
  }

  @returns via cbk or Promise
*/
module.exports = ({from, id, named, reply, request, version}, cbk) => {
  return new Promise((resolve, reject) => {
    return asyncAuto({
      // Check arguments
      validate: cbk => {
        if (!from) {
          return cbk([400, 'ExpectedFromUserIdNumberForVersionCommand']);
        }

        if (!named) {
          return cbk([400, 'ExpectedPackageNameStringToHandleVersionCommand']);
        }

        if (!reply) {
          return cbk([400, 'ExpectedReplyFunctionToHandleVersionCommand']);
        }

        if (!request) {
          return cbk([400, 'ExpectedRequestFunctionToHandleVersionCommand']);
        }

        if (!version) {
          return cbk([400, 'ExpectedVersionStringToHandleVersionCommand']);
        }

        return cbk();
      },

      // Authenticate the command caller is authorized to this command
      checkAccess: ['validate', ({}, cbk) => {
        return checkAccess({from, id, reply}, cbk);
      }],

      // Get version from NPM
      getVersion: ['checkAccess', ({}, cbk) => {
        reply(currentVersion(version));

        return request({json: true, url: url(named)}, (err, r, pkg) => {
          if (!!err || !r || r.statusCode !== ok || !pkg || !pkg.version) {
            reply(failedToGetVersion);

            return cbk();
          }

          reply(latestVersion(pkg.version));

          return cbk();
        });
      }],
    },
    returnResult({reject, resolve}, cbk));
  });
};
