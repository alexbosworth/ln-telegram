const asyncAuto = require('async/auto');
const fiat = require('@alexbosworth/fiat');
const {returnResult} = require('asyncjs-util');

const defaultFiatRateProvider = 'coingecko';
const defaultTokens = '';
const fiatTokens = n =>  Number(n.split('*')[0]);
const fiatRate = n => Math.round(n/100).toFixed(2);
const hasFiat = n => /(usd)/gim.test(n);
const {isInteger} = Number;
const isNumber = n => !isNaN(n);
const symbols = ['USD'];
const tokensAsBigTokens = n => Math.round(n * 1e8);

/** Parse tokens

  {
    request: <NodeJs Request Function>
    [tokens]: <Amount Tokens String>
  }

  @returns via cbk or Promise
  {
    [error]: <Is Parsing Error Boolean>
    [is_fraction_error]: <Is Fractional Error Boolean>
    [rate]: <Fiat Exachange Rate Number>
    [tokens]: <Amount Number>
  }
*/
module.exports = ({request, tokens}, cbk) => {
  return new Promise((resolve, reject) => {
    return asyncAuto({
      validate: cbk => {
        if (!request) {
          return cbk([400, 'ExpectedRequestFunctionToDecodeTokens']);
        }

        return cbk();
      },

      // Get price
      getFiatPrice: ['validate', ({}, cbk) => {
        // Exit early if there is no fiat
        if (!tokens || !hasFiat(tokens)) {
          return cbk();
        }

        return fiat.getPrices({
          request,
          symbols,
          from: defaultFiatRateProvider,
        },
        cbk);
      }],

      // Parse tokens
      parseTokens: ['getFiatPrice', ({getFiatPrice}, cbk) => {
        // Exit early if no tokens are provided
        if (!tokens) {
          return cbk(null, {tokens: defaultTokens});
        }

        if (!!getFiatPrice) {
          const fiat = getFiatPrice.tickers.find(n => n.ticker.toUpperCase() === 'USD');

          const amount = fiatTokens(tokens) / Number(fiatRate(fiat.rate));

          if (!amount ||  !isNumber(amount)) {
            return cbk(null, {error: true});
          }
          
          return cbk(null, {rate: fiatRate(fiat.rate), tokens: tokensAsBigTokens(amount)});
        }

        // Exit early when the amount cannot be parsed as tokens
        if (!isNumber(tokens)) {
          return cbk(null, {error: true});
        }

        // Exit early when the amount is fractional
        if (!isInteger(Number(tokens))) {
          return cbk(null, {is_fraction_error: true});
        }

        return cbk(null, {tokens: Number(tokens)});
      }]

    },
    returnResult({reject, resolve, of: 'parseTokens'}, cbk));
  });
};
