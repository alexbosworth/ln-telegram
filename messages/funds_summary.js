const {getBorderCharacters} = require('table');
const renderTable = require('table').table;

const {formatTokens} = require('./../interface');
const {icons} = require('./../interface');
const {preventLinks} = require('./../interface');

const border = getBorderCharacters('void');
const escape = text => text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\\$&');
const formatCoins = tokens => formatTokens({tokens, none: ''}).display;
const formatReport = (from, n) => `${from}\`\`\`\n${n}\`\`\``;
const noLinks = text => preventLinks({text}).text;
const sumOf = arr => arr.reduce((sum, n) => sum + n, Number());

/** Message summarizing funds

  {
    balances: [{
      closing_balance: <Balance of Tokens Moving Out Of Channels Tokens Number>
      offchain_balance: <Balance of Owned Tokens In Channels Tokens Number>
      offchain_pending: <Total Pending Local Balance Tokens Number>
      onchain_confirmed: <Confirmed On Chain Balance Tokens Number>
      onchain_pending: <Pending Chain Tokens Balance Tokens Number>
    }]
    nodes: [{
      from: <From Name String>
      lnd: <Authenticated LND API Object>
      public_key: <Public Key Hex String>
    }]
  }

  @returns
  {
    message: <Message Text String>
  }
*/
module.exports = ({balances, nodes}) => {
  const [, otherNode] = nodes;

  const total = sumOf(nodes.map((node, index) => {
    return sumOf([
      balances[index].closing_balance,
      balances[index].offchain_balance,
      balances[index].offchain_pending,
      balances[index].onchain_confirmed,
      balances[index].onchain_pending,
    ]);
  }));

  const overallTotal = escape(formatTokens({tokens: total}).display);

  const table = nodes
    .map((node, index) => {
      const total = sumOf([
        balances[index].closing_balance,
        balances[index].offchain_balance,
        balances[index].offchain_pending,
        balances[index].onchain_confirmed,
        balances[index].onchain_pending,
      ]);

      const displayTotal = escape(formatTokens({tokens: total}).display);
      const icon = !!otherNode ? `${icons.funds} ` : '';

      const from = `_${icon}${escape(noLinks(node.from))}_: ${displayTotal}\n`;

      // Exit early when there are no individual balances
      if (!total) {
        return from;
      }

      const rows = [
        [
          'Channel Balance',
          formatCoins(balances[index].offchain_balance),
        ],
        [
          'Channel Pending',
          formatCoins(balances[index].offchain_pending),
        ],
        [
          'Closing Out',
          formatCoins(balances[index].closing_balance),
        ],
        [
          'Chain Confirmed',
          formatCoins(balances[index].onchain_confirmed),
        ],
        [
          'Chain Pending',
          formatCoins(balances[index].onchain_pending),
        ],
      ];

      return formatReport(
        from,
        renderTable(rows.filter(([, n]) => !!n), {border, singleLine: true})
      );
    });

  const header = `*Funds:* ${overallTotal}\n\n`;
  const icon = !otherNode ? `${icons.funds} ` : '';

  return {message: `${icon}${header}${table.join('')}`};
};
