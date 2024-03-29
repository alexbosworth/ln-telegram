const {getBorderCharacters} = require('table');
const renderTable = require('table').table;

const {formatTokens} = require('./../interface');
const {icons} = require('./../interface');

const border = getBorderCharacters('void');
const escape = text => text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\\$&');
const formatFee = n => n === undefined ? '' : `${(n/1e4).toFixed(2)}% (${n})`;
const formatLiquidity = tokens => formatTokens({tokens, none: '-'}).display;
const formatReport = (from, n) => `${from}\`\`\`\n${n}\`\`\``;
const head = `*Liquidity:*\n\n`;
const noFrom = '';
const peerTitle = (query, k) => `*Liquidity with ${query} ${k}:*\n\n`;
const shortId = key => key.substring(0, 8);

/** Message summarizing liquidity

  {
    [alias]: <Alias String>
    inbound: [{
      balance: <Balance Tokens Number>
      [fee_rate]: Fee Rate Number>
      public_key: <Public Key Hex String>
    }]
    nodes: [{
      from: <From Name String>
      lnd: <Authenticated LND API Object>
      public_key: <Public Key Hex String>
    }]
    outbound: [{
      balance: <Balance Tokens Number>
      [fee_rate]: Fee Rate Number>
      public_key: <Public Key Hex String>
    }]
    [peer]: <Peer Public Key Hex String>
  }

  @returns
  {
    message: <Message Text String>
  }
*/
module.exports = ({alias, inbound, nodes, outbound, peer}) => {
  const [, otherNode] = nodes;

  const header = !!peer ? peerTitle(escape(alias), shortId(peer)) : head;
  const icon = !otherNode ? `${icons.liquidity} ` : '';

  const table = nodes
    .filter(node => {
      const local = outbound.find(n => n.public_key === node.public_key);
      const remote = inbound.find(n => n.public_key === node.public_key);

      return !!local.balance || !!remote.balance;
    })
    .map(node => {
      const local = outbound.find(n => n.public_key === node.public_key);
      const named = escape(node.from).trim();
      const remote = inbound.find(n => n.public_key === node.public_key);

      const from = !otherNode ? noFrom : `_${icons.liquidity} ${named}_:\n`;

      const rows = [
        [
          'Inbound',
          formatLiquidity(remote.balance),
          formatFee(remote.fee_rate),
        ],
        [
          'Outbound',
          formatLiquidity(local.balance),
          formatFee(local.fee_rate),
        ],
      ];

      return formatReport(from, renderTable(rows, {border, singleLine: true}));
    });

  return {message: `${icon}${header}${table.join('')}`};
};
