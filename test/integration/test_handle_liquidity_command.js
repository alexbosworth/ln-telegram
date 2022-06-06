const asyncRetry = require('async/retry');
const {getNode} = require('lightning');
const {setupChannel} = require('ln-docker-daemons');
const {spawnLightningCluster} = require('ln-docker-daemons');
const {test} = require('@alexbosworth/tap');

const {handleLiquidityCommand} = require('./../../');

const interval = 10;
const size = 2;
const times = 10000;

// Issuing a liquidity command should return a liquidity response
test(`Handle liquidity command`, async ({end, strictSame}) => {
  const {kill, nodes} = await spawnLightningCluster({size});
  const replies = [];

  const [{generate, id, lnd}, target] = nodes;

  try {
    await setupChannel({generate, lnd, to: target});

    // Wait for target graph announcement
    await asyncRetry({interval, times}, async () => {
      if (!(await getNode({lnd, public_key: target.id})).alias) {
        throw new Error('ExpectedNodeAliasFoundInGraph');
      }
    });

    await handleLiquidityCommand({
      from: 1,
      id: 1,
      nodes: [{lnd, from: 'from', public_key: id}],
      reply: (message) => replies.push(message.split('\n')),
      text: `/liquidity ${target.id}`,
      working: () => {},
    });

    strictSame(replies, [[
      `🌊 *Liquidity with ${target.id.substring(0, 20)} ${target.id.substring(0, 8)}:*`,
      '',
      '```',
      ' Inbound   -           0.00% (1) ',
      ' Outbound  0.00996530  0.00% (1) ',
      '',
      '```'
    ]],
    'Liquidity summary is posted');
  } catch (err) {
    strictSame(err, null, 'Expected no error');
  }

  await kill({});

  return end();
});
