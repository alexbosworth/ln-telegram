const {test} = require('tap');

const sendFile = require('./../../post/send_file');

const makeArgs = overrides => {
  const args = {
    filename: 'filename',
    hex: '00',
    id: 'id',
    key: 'key',
    request: ({qs}, cbk) => {
      return cbk(null, {statusCode: 200});
    },
  };

  Object.keys(overrides).forEach(k => args[k] = overrides[k]);

  return args;
};

const tests = [
  {
    args: makeArgs({filename: undefined}),
    description: 'Send file requires a filename',
    error: [400, 'ExpectedFileNameToSendToTelegram'],
  },
  {
    args: makeArgs({hex: undefined}),
    description: 'Send file requires a hex data file to send',
    error: [400, 'ExpectedHexDataToSendToTelegram'],
  },
  {
    args: makeArgs({id: undefined}),
    description: 'Send file requires a chat id',
    error: [400, 'ExpectedChatIdToSendMessageToTelegram'],
  },
  {
    args: makeArgs({key: undefined}),
    description: 'Send file requires a an api key',
    error: [400, 'ExpectedApiKeyToSendMessageToTelegram'],
  },
  {
    args: makeArgs({request: undefined}),
    description: 'Send file requires a request method',
    error: [400, 'ExpectedRequestFunctionToSendMessageToTelegram'],
  },
  {
    args: makeArgs({request: ({}, cbk) => cbk('err')}),
    description: 'Send file errors are passed back',
    error: [503, 'FailedToConnectToTelegramToSendFile'],
  },
  {
    args: makeArgs({request: ({}, cbk) => cbk()}),
    description: 'Send file expects a response',
    error: [503, 'ExpectedResponseFromTelegramSendDocument'],
  },
  {
    args: makeArgs({request: ({}, cbk) => cbk(null, {statusCode: 400})}),
    description: 'Send file expects a good response code',
    error: [503, 'UnexpectedStatusCodeSendingFileToTelegram'],
  },
  {
    args: makeArgs({}),
    description: 'Send file results in sent file',
  },
];

tests.forEach(({args, description, error, expected}) => {
  return test(description, async ({end, equal, rejects}) => {
    if (!!error) {
      await rejects(sendFile(args), error, 'Got expected error');
    } else {
      await sendFile(args);
    }

    return end();
  });
});
