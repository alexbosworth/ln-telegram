const {deepEqual} = require('node:assert').strict;
const {rejects} = require('node:assert').strict;
const test = require('node:test');

const {getInfoResponse} = require('./../fixtures');
const {getAmountAsTokens} = require('./../../interface');

const getInfoRes = () => JSON.parse(JSON.stringify(getInfoResponse));
const rates = {eur: {value: 50000}, usd: {value: 100000}};

const makeLnd = ({chain, network}) => {
  return {
    default: {
      getInfo: ({}, cbk) => {
        const res = getInfoRes();

        res.chains = [{
          chain: chain || 'bitcoin',
          network: network || 'mainnet',
        }];

        return cbk(null, res);
      },
    },
  };
};

const makeArgs = overrides => {
  const args = {
    amount: '1*USD',
    lnd: makeLnd({}),
    request: ({}, cbk) => cbk(null, {statusCode: 200}, {rates}),
  };

  Object.keys(overrides).forEach(k => args[k] = overrides[k]);

  return args;
};

const tests = [
  {
    args: makeArgs({amount: '1.5'}),
    description: 'A fractional number of tokens is not allowed',
    error: [400, 'ExpectedIntegerAmountToParseAmount'],
  },
  {
    args: makeArgs({lnd: undefined}),
    description: 'LND is required to convert a fiat amount',
    error: [400, 'ExpectedAuthenticatedLndApiToGetAmountAsTokens'],
  },
  {
    args: makeArgs({request: undefined}),
    description: 'A request function is required to convert a fiat amount',
    error: [400, 'ExpectedRequestFunctionToGetAmountAsTokens'],
  },
  {
    args: makeArgs({amount: undefined}),
    description: 'No amount is zero tokens',
    expected: {tokens: 0},
  },
  {
    args: makeArgs({amount: '1000', lnd: undefined, request: undefined}),
    description: 'A tokens amount does not need fiat prices',
    expected: {tokens: 1000},
  },
  {
    args: makeArgs({amount: '0.5*btc', lnd: undefined, request: undefined}),
    description: 'A BTC amount is converted to tokens',
    expected: {tokens: 50000000},
  },
  {
    args: makeArgs({}),
    description: 'A USD amount is converted to tokens',
    expected: {tokens: 1000},
  },
  {
    args: makeArgs({amount: '2*eur'}),
    description: 'A lowercase EUR amount is converted to tokens',
    expected: {tokens: 4000},
  },
  {
    args: makeArgs({amount: 'USD+EUR'}),
    description: 'Fiat amounts can be combined',
    expected: {tokens: 3000},
  },
  {
    args: makeArgs({lnd: makeLnd({network: 'regtest'})}),
    description: 'A fiat amount is converted to tokens on regtest',
    expected: {tokens: 1000},
  },
  {
    args: makeArgs({lnd: makeLnd({network: 'signet'})}),
    description: 'A fiat amount is converted to tokens on signet',
    expected: {tokens: 1000},
  },
  {
    args: makeArgs({lnd: makeLnd({network: 'testnet'})}),
    description: 'A fiat amount is converted to tokens on testnet',
    expected: {tokens: 1000},
  },
  {
    args: makeArgs({lnd: makeLnd({network: 'testnet4'})}),
    description: 'A fiat amount is converted to tokens on testnet4',
    expected: {tokens: 1000},
  },
  {
    args: makeArgs({lnd: makeLnd({chain: 'litecoin'})}),
    description: 'A fiat amount cannot be converted on a chain other than BTC',
    error: [400, 'UnsupportedCurrencyForFiatConversion'],
  },
  {
    args: makeArgs({request: ({}, cbk) => cbk('err')}),
    description: 'An error getting fiat prices is passed back',
    error: [503, 'UnexpectedErrorGettingCoingeckoRates', {err: 'err'}],
  },
  {
    args: makeArgs({lnd: {default: {getInfo: ({}, cbk) => cbk('err')}}}),
    description: 'An error getting the network is passed back',
    error: [503, 'GetWalletInfoErr', {err: 'err'}],
  },
  {
    args: makeArgs({amount: 'invalid', lnd: undefined, request: undefined}),
    description: 'An amount that cannot be parsed is rejected',
    error: [
      400,
      'FailedToParseAmount',
      {err: new Error('ExpectedAllKnownConstantsInFormulaToEvaluate')},
    ],
  },
];

tests.forEach(({args, description, error, expected}) => {
  return test(description, async () => {
    if (!!error) {
      await rejects(getAmountAsTokens(args), error, 'Got expected error');
    } else {
      const res = await getAmountAsTokens(args);

      deepEqual(res, expected, 'Got expected result');
    }

    return;
  });
});
