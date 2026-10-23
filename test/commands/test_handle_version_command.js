const {deepEqual} = require('node:assert').strict;
const {rejects} = require('node:assert').strict;
const test = require('node:test');

const {handleVersionCommand} = require('./../../');

const defaultResponse = [null, {statusCode: 200}, {version: '2.0.0'}];
const url = 'https://registry.npmjs.org/ln-telegram/latest';

const makeArgs = (overrides, response) => {
  const calls = {replies: [], requests: []};

  const args = {
    calls,
    from: 1,
    id: 1,
    named: 'ln-telegram',
    reply: text => calls.replies.push(text),
    request: (options, cbk) => {
      calls.requests.push(options);

      return cbk(...(response || defaultResponse));
    },
    version: '1.0.0',
  };

  Object.keys(overrides).forEach(k => args[k] = overrides[k]);

  return args;
};

const tests = [
  {
    args: makeArgs({from: undefined}),
    description: 'The id of the user sending the command is expected',
    error: [400, 'ExpectedFromUserIdNumberForVersionCommand'],
  },
  {
    args: makeArgs({named: undefined}),
    description: 'The name of the package is expected',
    error: [400, 'ExpectedPackageNameStringToHandleVersionCommand'],
  },
  {
    args: makeArgs({reply: undefined}),
    description: 'A reply function is expected',
    error: [400, 'ExpectedReplyFunctionToHandleVersionCommand'],
  },
  {
    args: makeArgs({request: undefined}),
    description: 'A request function is expected',
    error: [400, 'ExpectedRequestFunctionToHandleVersionCommand'],
  },
  {
    args: makeArgs({version: undefined}),
    description: 'The current version is expected',
    error: [400, 'ExpectedVersionStringToHandleVersionCommand'],
  },
  {
    args: makeArgs({from: 2}),
    description: 'Only the connected user can check the version',
    error: [401, 'CommandRequiresConnectCode'],
  },
  {
    args: makeArgs({}),
    description: 'The running and the latest versions are posted',
    expected: {
      replies: ['🤖 Running version: 1.0.0', '🤖 Latest version: 2.0.0'],
      requests: [{url, json: true}],
    },
  },
  {
    args: makeArgs({}, ['err']),
    description: 'A failure to get the latest version is posted',
    expected: {
      replies: [
        '🤖 Running version: 1.0.0',
        '🤖 Failed to get latest version information from NPM',
      ],
      requests: [{url, json: true}],
    },
  },
  {
    args: makeArgs({}, []),
    description: 'A missing NPM response is posted as a failure',
    expected: {
      replies: [
        '🤖 Running version: 1.0.0',
        '🤖 Failed to get latest version information from NPM',
      ],
      requests: [{url, json: true}],
    },
  },
  {
    args: makeArgs({}, [null, {statusCode: 404}, {}]),
    description: 'An unexpected NPM status code is posted as a failure',
    expected: {
      replies: [
        '🤖 Running version: 1.0.0',
        '🤖 Failed to get latest version information from NPM',
      ],
      requests: [{url, json: true}],
    },
  },
  {
    args: makeArgs({}, [null, {statusCode: 200}]),
    description: 'A missing NPM package is posted as a failure',
    expected: {
      replies: [
        '🤖 Running version: 1.0.0',
        '🤖 Failed to get latest version information from NPM',
      ],
      requests: [{url, json: true}],
    },
  },
  {
    args: makeArgs({}, [null, {statusCode: 200}, {}]),
    description: 'A missing NPM package version is posted as a failure',
    expected: {
      replies: [
        '🤖 Running version: 1.0.0',
        '🤖 Failed to get latest version information from NPM',
      ],
      requests: [{url, json: true}],
    },
  },
];

tests.forEach(({args, description, error, expected}) => {
  return test(description, async () => {
    if (!!error) {
      await rejects(handleVersionCommand(args), error, 'Got expected error');
    } else {
      await handleVersionCommand(args);

      deepEqual(args.calls, expected, 'Got expected result');
    }

    return;
  });
});
