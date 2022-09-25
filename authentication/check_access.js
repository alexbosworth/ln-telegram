const asyncAuto = require('async/auto');
const {returnResult} = require('asyncjs-util');

const interaction = require('./../interaction');

/** Check access to private commands

  {
    from: <Source User Id Number>
    id: <Connected User Id Number>
  }

  @returns via cbk or Promise
*/
module.exports = ({from, id}, cbk) => {
  return new Promise((resolve, reject) => {
    return asyncAuto({
      // Check arguments
      validate: cbk => {
        if (!from) {
          return cbk([400, 'ExpectedFromUserIdToCheckAccess']);
        }

        return cbk();
      },

      // Check access
      checkAccess: ['validate', ({}, cbk) => {
        if (!id || from !== id) {
          return cbk([401, 'CommandRequiresConnectCode']);
        }

        return cbk();
      }],
    },
    returnResult({reject, resolve}, cbk));
  });
};
