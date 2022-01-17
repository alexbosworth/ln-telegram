const {encodeTrade} = require('paid-services');

const join = arr => arr.filter(n => !!n).join('\n');
const markup = undefined;
const mode = 'MarkdownV2';
const tokensAsBigTokens = tokens => (tokens / 1e8).toFixed(8);
const escape = text => text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\\$&');

/** Created trade message

  {
    [from]: <Invoice From Node String>
    description: <Trade Description String>
    expires_at: <Trade Expires at ISO 8601 Date String>
    id: <Trade Id Hex String>
    destination: <Trade Destination Public Key Hex String>
    network: <Network Name String>
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
  const memo = !args.description ? '' : `“${escape(args.description)}”`;

  const {trade} = encodeTrade({
    connect: {
      id: args.id,
      network: args.network,
      nodes: [{channels: [], id: args.destination, sockets: []}],
    },
  });

  const text = join([
    `Trade\\\-Secret: ${escape(tokensAsBigTokens(args.tokens))} ${memo}`,
    `\`${trade}\``,
    `${escape(args.from || '')}`,
  ]);

  return {markup, mode, text};
};
