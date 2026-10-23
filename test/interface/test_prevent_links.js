const {deepEqual} = require('node:assert').strict;
const test = require('node:test');

const {preventLinks} = require('./../../interface');

const tests = [
  {
    args: {text: 'alias'},
    description: 'Text that would not be linked is not changed',
    expected: {text: 'alias'},
  },
  {
    args: {text: ''},
    description: 'Empty text is not changed',
    expected: {text: ''},
  },
  {
    args: {text: undefined},
    description: 'Missing text is not changed',
    expected: {text: undefined},
  },
  {
    args: {text: 'lnd.example.com @lightning'},
    description: 'A domain name and a mention both get word joiners',
    expected: {text: 'lnd.\u2060example.\u2060com @\u2060lightning'},
  },
  {
    args: {text: '@lightning'},
    description: 'A mention gets a word joiner',
    expected: {text: '@\u2060lightning'},
  },
  {
    args: {text: '@bob'},
    description: 'A mention that is too short to be a username is not changed',
    expected: {text: '@bob'},
  },
  {
    args: {text: '@gif'},
    description: 'A short mention that Telegram knows gets a word joiner',
    expected: {text: '@\u2060gif'},
  },
  {
    args: {text: '@GIF @Gif @NFT @Pic @UFC @Vid'},
    description: 'Short mentions are checked without regard to case',
    expected: {text: '@\u2060GIF @\u2060Gif @\u2060NFT @\u2060Pic @\u2060UFC @\u2060Vid'},
  },
  {
    args: {text: '@BOB'},
    description: 'An unknown short mention is not changed in upper case',
    expected: {text: '@BOB'},
  },
  {
    args: {text: 'Node @ Home'},
    description: 'An at sign that is not a mention is not changed',
    expected: {text: 'Node @ Home'},
  },
  {
    args: {text: '#reckless'},
    description: 'A hashtag gets a word joiner',
    expected: {text: '#\u2060reckless'},
  },
  {
    args: {text: 'C# #1'},
    description: 'Number signs that are not hashtags are not changed',
    expected: {text: 'C# #1'},
  },
  {
    args: {text: '$BTC'},
    description: 'A cashtag gets a word joiner',
    expected: {text: '$\u2060BTC'},
  },
  {
    args: {text: '$5'},
    description: 'A dollar sign that is not a cashtag is not changed',
    expected: {text: '$5'},
  },
  {
    args: {text: '/start'},
    description: 'A command gets a word joiner',
    expected: {text: '/\u2060start'},
  },
  {
    args: {text: 'AC/DC /dev/null'},
    description: 'Slashes that are not commands are not changed',
    expected: {text: 'AC/DC /dev/null'},
  },
  {
    args: {text: 'tg://resolve?domain=telegram'},
    description: 'A Telegram deep link gets a word joiner after the colon',
    expected: {text: 'tg:\u2060//resolve?domain=telegram'},
  },
  {
    args: {text: 'TG://resolve?domain=telegram'},
    description: 'An upper case Telegram deep link gets a word joiner',
    expected: {text: 'TG:\u2060//resolve?domain=telegram'},
  },
  {
    args: {text: 'ton://transfer/abc'},
    description: 'A TON deep link gets a word joiner after the colon',
    expected: {text: 'ton:\u2060//transfer/abc'},
  },
  {
    args: {text: 'tonsite://example.ton'},
    description: 'A TON site link gets joiners after the colon and dots',
    expected: {text: 'tonsite:\u2060//example.\u2060ton'},
  },
  {
    args: {text: 'tg:// ton:// tonsite://'},
    description: 'Protocols without a host are not changed',
    expected: {text: 'tg:// ton:// tonsite://'},
  },
  {
    args: {text: 'tg:\u2060//resolve?domain=telegram'},
    description: 'A deep link that already has a joiner is not changed',
    expected: {text: 'tg:\u2060//resolve?domain=telegram'},
  },
  {
    args: {text: '@\u2060lightning #\u2060reckless'},
    description: 'Text that already has word joiners is not changed',
    expected: {text: '@\u2060lightning #\u2060reckless'},
  },
];

tests.forEach(({args, description, expected}) => {
  return test(description, () => deepEqual(preventLinks(args), expected));
});
