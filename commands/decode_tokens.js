const asyncAuto = require('async/auto');
const fiat = require('@alexbosworth/fiat');
const {returnResult} = require('asyncjs-util');

const parseAmount = require('./parse_amount');
const defaultFiatRateProvider = 'coingecko';
const defaultTokens = '';
const fiatRate = n => Math.round(n/100).toFixed(2);
const hasFiat = n => /(eur|usd)/gim.test(n);
const {isInteger} = Number;
const symbols = ['EUR', 'USD'];
const tokensAsBigTokens = n => Math.round(n * 1e8);

/** Parse tokens

  {
    request: <Request Function>
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
        
        try {
          const parsedTokens = parseAmount({amount: tokens});
          
          // Exit early when using a fiat denominated invoice
          if (!!getFiatPrice) {
            const fiat = getFiatPrice.tickers.find(n => {
              if (tokens.toUpperCase().includes('EUR')) {
                return n.ticker.toUpperCase() === 'EUR';
              }
  
              if (tokens.toUpperCase().includes('USD')) {
                return n.ticker.toUpperCase() === 'USD';
              }
            });

            const amount = Number(parsedTokens.tokens) / Number(fiatRate(fiat.rate));
  
            return cbk(null, {rate: fiatRate(fiat.rate), tokens: tokensAsBigTokens(amount)});
          }

          // Exit early when the amount is fractional
          if (!isInteger(parsedTokens.tokens)) {
            return cbk(null, {is_fraction_error: true});
          }

          return cbk(null, {tokens: parsedTokens.tokens});
        } catch (err) {
          return cbk(null, {error: true});            
        }
      }]

    },
    returnResult({reject, resolve, of: 'parseTokens'}, cbk));
  });
};
