const {deepEqual} = require('node:assert').strict;
const {rejects} = require('node:assert').strict;
const {setImmediate} = require('node:timers/promises');
const test = require('node:test');

const authentication = require('./../../authentication');
const handlers = require('./../fixtures/lookup_handlers');

const {checkAccess} = authentication;
const denied = [401, 'CommandRequiresConnectCode'];
const key = Buffer.alloc(33, 2).toString('hex');

const makeArgs = ({from, id}) => {
  const calls = [];

  const effect = name => async () => { calls.push(name); };

  // Record any attempt to use a node, including failed RPC validation.
  const lnd = new Proxy({}, {
    get: ({}, property) => {
      calls.push(`lnd.${String(property)}`);

      return undefined;
    },
  });

  const message = {
    from: {id: from},
    text: 'new description',
    reply_to_message: {text: 'private invoice'},
  };

  return {
    calls,
    args: {
      from,
      id,
      api: {deleteMessage: effect('api.deleteMessage')},
      bot: {stop: effect('bot.stop')},
      budget: 100,
      ctx: {
        message,
        answerCallbackQuery: effect('ctx.answerCallbackQuery'),
        deleteMessage: effect('ctx.deleteMessage'),
        editMessageText: effect('ctx.editMessageText'),
        reply: effect('ctx.reply'),
        update: {
          message,
          callback_query: {
            data: 'cancel-invoice',
            from: {id: from},
            message: {text: 'private invoice'},
          },
        },
      },
      named: 'ln-telegram',
      nodes: [
        {
          lnd,
          alias: 'private node 1',
          from: 'private node 1',
          public_key: key,
        },
        {
          lnd,
          alias: 'private node 2',
          from: 'private node 2',
          public_key: key,
        },
      ],
      remove: effect('remove'),
      reply: effect('reply'),
      request: () => { calls.push('request'); },
      send: effect('send'),
      text: '/pay',
      version: '1.0.0',
      working: effect('working'),
    },
  };
};

// Reload only the handler so its access check can be held pending. Restore
// both exports and the module cache before running it to isolate other tests.
const withPendingAccess = file => {
  const path = require.resolve(`./../../${file}`);

  const cached = require.cache[path];
  const pending = [];

  authentication.checkAccess = (args, cbk) => pending.push({args, cbk});

  try {
    delete require.cache[path];

    return {pending, method: require(path)};
  } finally {
    authentication.checkAccess = checkAccess;

    if (!!cached) {
      require.cache[path] = cached;
    } else {
      delete require.cache[path];
    }
  }
};

handlers.forEach(file => {
  const method = require(`./../../${file}`);

  [
    {description: 'another user', from: 2, id: 1, error: denied},
    {description: 'a string user id', from: '1', id: 1, error: denied},
    {description: 'a missing connection', from: 1, id: undefined},
    {description: 'a missing sender', from: undefined, id: 1},
  ].forEach(({description, error, from, id}) => {
    ['Promise', 'callback'].forEach(mode => {
      return test(`${file} blocks ${description} via ${mode}`, async () => {
        const {args, calls} = makeArgs({from, id});

        const result = mode === 'Promise' ? method(args) :
          new Promise((resolve, reject) => {
            method(args, (err, res) => !!err ? reject(err) : resolve(res));
          });

        await rejects(result, err => {
          if (!!error) {
            deepEqual(err, error, 'Access is denied');
          } else {
            deepEqual(Array.isArray(err), true, 'Got a structured error');
            deepEqual(
              [400, 401].includes(err[0]), true, 'Access fails closed'
            );
          }

          return true;
        });

        await setImmediate();

        deepEqual(calls, [], 'No lookups or side effects without access');
      });
    });
  });

  test(`${file} waits for authorization before starting work`, async () => {
    const {args, calls} = makeArgs({from: 2, id: 1});
    const {method, pending} = withPendingAccess(file);

    const result = method(args).then(value => ({value}), error => ({error}));

    await setImmediate();

    const before = calls.slice();

    // Complete the delayed check using the real authorization implementation.
    pending.forEach(({args, cbk}) => checkAccess(args, cbk));

    deepEqual(
      await result, {error: denied}, 'Authorization failure is returned'
    );
    deepEqual(
      pending.map(n => n.args), [{from: 2, id: 1}], 'Checks the caller'
    );
    deepEqual(before, [], 'No work starts while authorization is pending');
    deepEqual(calls, [], 'No work starts after authorization fails');
  });
});
