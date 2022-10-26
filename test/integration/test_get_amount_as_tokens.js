const {spawnLightningCluster} = require('ln-docker-daemons');
const {test} = require('@alexbosworth/tap');

const {getAmountAsTokens} = require('./../../interface');

// Get amount as tokens
test(`Get an amount as tokens`, async ({end, strictSame}) => {
  const {kill, nodes} = await spawnLightningCluster({});

  const [{generate, id, lnd}] = nodes;

  // An invalid amount will fail to parse
  try {
    strictSame(await getAmountAsTokens({amount: 'foo'}), null, 'Fails');
  } catch (err) {
    strictSame(
      err,
      [
        400,
        'FailedToParseAmount',
        {err: new Error('UnrecognizedVariableOrFunctionInSpecifiedAmount')}
      ],
      'Invalid amount'
    );
  }

  // A fractional amount will fail to parse
  try {
    strictSame(await getAmountAsTokens({amount: '0.1'}), null, 'Fails');
  } catch (err) {
    strictSame(err, [400, 'ExpectedIntegerAmountToParseAmount'], 'Fractional');
  }

  try {
    // The default is zero
    strictSame(await getAmountAsTokens({}), {tokens: 0}, 'Default is zero');

    // Regular numbers parse as tokens
    strictSame(await getAmountAsTokens({amount: '1'}), {tokens: 1}, 'Number');

    // Multiplication is parsed
    strictSame(
      await getAmountAsTokens({amount: '1*btc'}),
      {tokens: 1e8},
      'Amount is parsed'
    );

    // Fiat is parsed
    const {tokens} = await getAmountAsTokens({
      lnd,
      amount: '1*usd',
      request: ({}, cbk) => cbk(
        null,
        {statusCode: 200},
        {rates: {eur: {value: 2}, usd: {value: 20000}}},
      ),
    });

    strictSame(tokens, 5000, 'Fiat value');
  } catch (err) {
    strictSame(err, null, 'Expected no error');
  }

  await kill({});

  return end();
});
