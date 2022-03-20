const {encodeTrade} = require('paid-services');
const {DateTime} = require('luxon');

const {formatTokens} = require('./../interface');
const {titles} = require('./../interface');
const tradeEditButtons = require('./trade_edit_buttons');

const escape = text => text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\\$&');
const {fromISO} = DateTime;
const join = arr => arr.filter(n => !!n).join('\n');
const mode = 'MarkdownV2';
const titlePrefix = titles.createdTradePrefix;

/** Created trade message

  {
    [from]: <Invoice From Node String>
    description: <Trade Description String>
    expires_at: <Trade Expires at ISO 8601 Date String>
    id: <Trade Id Hex String>
    destination: <Trade Destination Public Key Hex String>
    network: <Network Name String>
    nodes: [{
      from: <Saved Node Name>
      public_key: <Public Key Hex String>
    }]
    tokens: <Trade Price Number>
  }

  @returns
  {
    markup: <Reply Markup Object>
    mode: <Message Parse Mode String>
    text: <Message Text String>
  }
*/
module.exports = args => {
  const expiry = escape(fromISO(args.expires_at).toLocaleString());
  const {markup} = tradeEditButtons({nodes: args.nodes});
  const memo = !args.description ? '' : `“${escape(args.description)}” `;
  const price = escape(formatTokens({tokens: args.tokens}).display);

  const {trade} = encodeTrade({
    connect: {
      id: args.id,
      network: args.network,
      nodes: [{channels: [], id: args.destination, sockets: []}],
    },
  });

  const text = join([
    `${escape(titlePrefix)}${price} ${memo}expires ${expiry}`,
    `\`${trade}\``,
    `${escape(args.from || '')}`,
  ]);

  return {markup, mode, text};
};
