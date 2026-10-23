const {formatTokens} = require('./../interface');
const {preventLinks} = require('./../interface');

const join = arr => arr.filter(n => !!n).join('\n');
const markup = undefined;
const mode = 'MarkdownV2';
const noLinks = text => preventLinks({text}).text;
const escape = text => text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\\$&');

/** Settle trade message

  {
    alias: <Sold to Node with Alias String>
    description: <Trade Description String>
    [from]: <Invoice From Node String>
    to: <Sold to Node with Identity Public Key Hex String>
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
  const to = `${escape(noLinks(args.alias))} \`${args.to}\``.trim();

  const text = join([
    `😎 Sold: ${escape(formatTokens({tokens: args.tokens}).display)} ${memo}`,
    `to ${to}`,
    `${escape(noLinks(args.from || ''))}`,
  ]);

  return {markup, mode, text};
};
