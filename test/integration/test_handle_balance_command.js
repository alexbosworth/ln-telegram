const {getNode} = require('lightning');
const {setupChannel} = require('ln-docker-daemons');
const {spawnLightningCluster} = require('ln-docker-daemons');
const {test} = require('@alexbosworth/tap');

const {handleBalanceCommand} = require('./../../');

const size = 2;

// Issuing a balance command should return a balance response
test(`Handle balance command`, async ({end, strictSame}) => {
  const {kill, nodes} = await spawnLightningCluster({size});
  const replies = [];

  const [{generate, id, lnd}, target] = nodes;

  try {
    await setupChannel({generate, lnd, give_tokens: 1e3, to: target});

    await handleBalanceCommand({
      from: 1,
      id: 1,
      nodes: [
        {lnd, from: 'control', public_key: id},
        {from: 'target', lnd: target.lnd, public_key: target.id},
      ],
      reply: (message) => replies.push(message.split('\n')),
      working: () => {},
    });

    strictSame(replies, [[
      '*Funds:* 349\\.99834590',
      '',
      '_🪙 control_: 349\\.99833590',
      '```',
      ' Channel Balance  0.00998340   ',
      ' Chain Confirmed  349.98835250 ',
      '',
      '```_🪙 target_: 0\\.00001000',
      '```',
      ' Channel Balance  0.00001000 ',
      '',
      '```'
    ]],
    'Balance summary is posted');
  } catch (err) {
    strictSame(err, null, 'Expected no error');
  }

  await kill({});

  return end();
});
