const {deepEqual} = require('node:assert').strict;
const {rejects} = require('node:assert').strict;
const test = require('node:test');

const {handleBackupCommand} = require('./../../');

const date = new Date().toISOString().substring(0, 10);
const key1 = Buffer.alloc(33, 2).toString('hex');
const key2 = Buffer.alloc(33, 3).toString('hex');

const makeLnd = ({backup, channels, err}) => {
  return {
    default: {
      exportAllChannelBackups: ({}, cbk) => {
        if (!!err) {
          return cbk(err);
        }

        const outpoints = [...Array(channels)].map((value, index) => ({
          funding_txid_bytes: Buffer.alloc(32, index),
          output_index: index,
        }));

        return cbk(null, {
          multi_chan_backup: {
            chan_points: outpoints,
            multi_chan_backup: Buffer.from(backup),
          },
          single_chan_backups: {
            chan_backups: outpoints.map(chanPoint => ({
              chan_backup: Buffer.from(backup),
              chan_point: chanPoint,
            })),
          },
        });
      },
    },
  };
};

const makeArgs = overrides => {
  const calls = {sent: []};

  const args = {
    calls,
    from: 1,
    id: 1,
    nodes: [{
      alias: 'alias1',
      lnd: makeLnd({backup: 'backup1', channels: 2}),
      public_key: key1,
    }],
    reply: async () => {},
    send: async (document, options) => calls.sent.push({document, options}),
  };

  Object.keys(overrides).forEach(k => args[k] = overrides[k]);

  return args;
};

const tests = [
  {
    args: makeArgs({from: undefined}),
    description: 'The id of the user sending the command is expected',
    error: [400, 'ExpectedFromUserIdToExecuteBackupCommand'],
  },
  {
    args: makeArgs({nodes: undefined}),
    description: 'An array of nodes is expected',
    error: [400, 'ExpectedNodesArrayToExecuteBackupCommand'],
  },
  {
    args: makeArgs({reply: undefined}),
    description: 'A reply function is expected',
    error: [400, 'ExpectedReplyFunctionToExecuteBackupCommand'],
  },
  {
    args: makeArgs({send: undefined}),
    description: 'A send document function is expected',
    error: [400, 'ExpectedSendDocumentFunctionToHandleBackupCmd'],
  },
  {
    args: makeArgs({from: 2}),
    description: 'Only the connected user can get backups',
    error: [401, 'CommandRequiresConnectCode'],
  },
  {
    args: makeArgs({
      nodes: [{
        alias: 'alias1',
        lnd: makeLnd({err: 'err'}),
        public_key: key1,
      }],
    }),
    description: 'An error getting backups is passed back',
    error: [503, 'UnexpectedErrorGettingAllChanBackups', {err: 'err'}],
  },
  {
    args: makeArgs({}),
    description: 'A backup file is sent',
    expected: {
      sent: [{
        document: {
          filename: `${date}-alias1-${key1}.backup`,
          source: Buffer.from('backup1'),
        },
        options: {caption: `Backup for 2 channels on alias1 ${key1}`},
      }],
    },
  },
  {
    args: makeArgs({
      nodes: [
        {
          alias: 'alias1',
          lnd: makeLnd({backup: 'backup1', channels: 2}),
          public_key: key1,
        },
        {
          alias: 'alias2',
          lnd: makeLnd({backup: 'backup2', channels: 0}),
          public_key: key2,
        },
      ],
    }),
    description: 'A backup file is sent for every node',
    expected: {
      sent: [
        {
          document: {
            filename: `${date}-alias1-${key1}.backup`,
            source: Buffer.from('backup1'),
          },
          options: {caption: `Backup for 2 channels on alias1 ${key1}`},
        },
        {
          document: {
            filename: `${date}-alias2-${key2}.backup`,
            source: Buffer.from('backup2'),
          },
          options: {caption: `Backup for 0 channels on alias2 ${key2}`},
        },
      ],
    },
  },
  {
    args: makeArgs({
      nodes: [{
        alias: 'alias1',
        lnd: makeLnd({backup: 'backup1', channels: 1}),
        public_key: key1,
      }],
    }),
    description: 'A backup file for a single channel is sent',
    expected: {
      sent: [{
        document: {
          filename: `${date}-alias1-${key1}.backup`,
          source: Buffer.from('backup1'),
        },
        options: {caption: `Backup for 1 channel on alias1 ${key1}`},
      }],
    },
  },
];

tests.forEach(({args, description, error, expected}) => {
  return test(description, async () => {
    if (!!error) {
      await rejects(handleBackupCommand(args), error, 'Got expected error');
    } else {
      await handleBackupCommand(args);

      deepEqual(args.calls, expected, 'Got expected result');
    }

    return;
  });
});
