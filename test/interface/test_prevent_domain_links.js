const {deepEqual} = require('node:assert').strict;
const test = require('node:test');

const preventDomainLinks = require('./../../interface/prevent_domain_links');

const tests = [
  {
    args: {text: 'alias'},
    description: 'Text without a domain name is not changed',
    expected: {text: 'alias'},
  },
  {
    args: {text: 'lnd.example.com'},
    description: 'Every dot in a domain name gets a word joiner',
    expected: {text: 'lnd.\u2060example.\u2060com'},
  },
  {
    args: {text: 'пример.рф'},
    description: 'An internationalized domain name gets a word joiner',
    expected: {text: 'пример.\u2060рф'},
  },
  {
    args: {text: 'example.xn--p1ai'},
    description: 'A punycode top level domain gets a word joiner',
    expected: {text: 'example.\u2060xn--p1ai'},
  },
  {
    args: {text: 'BITCOIN.ROCKS'},
    description: 'An upper case top level domain gets a word joiner',
    expected: {text: 'BITCOIN.\u2060ROCKS'},
  },
  {
    args: {text: 'Bitcoin.Rocks'},
    description: 'A capitalized top level domain is not linked by Telegram',
    expected: {text: 'Bitcoin.Rocks'},
  },
  {
    args: {text: 'umbrel.local'},
    description: 'A name without a known top level domain is not changed',
    expected: {text: 'umbrel.local'},
  },
  {
    args: {text: 'Mr.Smith'},
    description: 'A word after a dot that is not a TLD is not changed',
    expected: {text: 'Mr.Smith'},
  },
  {
    args: {text: 'https://umbrel.local/path'},
    description: 'A URL with a protocol gets a word joiner for any domain',
    expected: {text: 'https://umbrel.\u2060local/path'},
  },
  {
    args: {text: 'bob@example.com'},
    description: 'The domain of an email address gets a word joiner',
    expected: {text: 'bob@example.\u2060com'},
  },
  {
    args: {text: 'bob@example.Com'},
    description: 'An email address with a capitalized ending gets a joiner',
    expected: {text: 'bob@example.\u2060Com'},
  },
  {
    args: {text: 'bob@umbrel.local'},
    description: 'An email address needs no known top level domain',
    expected: {text: 'bob@umbrel.\u2060local'},
  },
  {
    args: {text: 'a@b.invalid'},
    description: 'A seven letter email ending gets a word joiner',
    expected: {text: 'a@b.\u2060invalid'},
  },
  {
    args: {text: 'a@b.examplex'},
    description: 'An eight letter email ending gets a word joiner',
    expected: {text: 'a@b.\u2060examplex'},
  },
  {
    args: {text: 'a@b.Invalid'},
    description: 'A capitalized seven letter email ending gets a joiner',
    expected: {text: 'a@b.\u2060Invalid'},
  },
  {
    args: {text: 'bob@umbrel.localhost'},
    description: 'An email address ending in over 8 letters is not changed',
    expected: {text: 'bob@umbrel.localhost'},
  },
  {
    args: {text: '@umbrel.local'},
    description: 'A domain after an at sign with no user is not an email',
    expected: {text: '@umbrel.local'},
  },
  {
    args: {text: '10.0.0.1:9735'},
    description: 'An IP address gets a word joiner',
    expected: {text: '10.\u20600.\u20600.\u20601:9735'},
  },
  {
    args: {text: 'LND v0.18.3-beta'},
    description: 'A version number is not changed',
    expected: {text: 'LND v0.18.3-beta'},
  },
  {
    args: {text: 'lnd.\u2060example.\u2060com'},
    description: 'A domain name that already has word joiners is not changed',
    expected: {text: 'lnd.\u2060example.\u2060com'},
  },
];

tests.forEach(({args, description, expected}) => {
  return test(description, () => {
    return deepEqual(preventDomainLinks(args), expected);
  });
});
