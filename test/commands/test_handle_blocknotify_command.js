const {rejects} = require('node:assert').strict;
const test = require('node:test');

const {handleBlocknotifyCommand} = require('./../../');

const makeArgs = overrides => {
  const args = {
    from: 1,
    id: 1,
    reply: () => {},
    request: ({}, cbk) => cbk('err'),
  };

  Object.keys(overrides).forEach(k => args[k] = overrides[k]);

  return args;
};

const tests = [
  {
    args: makeArgs({from: undefined}),
    description: 'The id of the user sending the command is expected',
    error: [400, 'ExpectedFromUserIdToHandleBlockNotifyCommand'],
  },
  {
    args: makeArgs({reply: undefined}),
    description: 'A reply function is expected',
    error: [400, 'ExpectedReplyFunctionToHandleBlockNotifyCommand'],
  },
  {
    args: makeArgs({request: undefined}),
    description: 'A request function is expected',
    error: [400, 'ExpectedRequestFunctionToHandleBlocknotifyCmd'],
  },
  {
    args: makeArgs({from: 2}),
    description: 'Only the connected user can get block notifications',
    error: [401, 'CommandRequiresConnectCode'],
  },
  {
    args: makeArgs({request: ({}, cbk) => cbk('err')}),
    description: 'An error getting the chain tip is passed back',
    error: [
      503,
      'UnexpectedErrorGettingBlock',
      {err: [503, 'UnexpectedErrorGettingChainTipHash', {err: 'err'}]},
    ],
  },
];

tests.forEach(({args, description, error}) => {
  return test(description, async () => {
    await rejects(handleBlocknotifyCommand(args), error, 'Got expected error');

    return;
  });
});
