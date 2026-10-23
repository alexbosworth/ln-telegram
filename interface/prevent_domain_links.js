const topLevelDomains = require('./top_level_domains');

const domains = /(?:[\w.~-]|[^\0-\xbf\p{C}\p{P}\p{Z}\u2000-\u206f])+/gu;
const edgeDots = /^\.+|\.+$/g;
const emailTld = /^[a-z]{2,8}$/i;
const emailUser = /[\w-]@$/;
const innerDots = /\.(?!$)/g;
const ipAddressParts = 4;
const isIpNumber = n => /^(0|[1-9]\d{0,2})$/.test(n) && Number(n) <= 255;
const protocol = /(https?|ftp|tonsite):\/\/([^\s/@]*@)?$/i;
const punycode = /^xn--[a-zA-Z\d]{2,}$/;
const tlds = new Set(topLevelDomains);
const wordJoiner = '\u2060';

/** Prevent Telegram from linking domain names and IP addresses in text

  Telegram links IP addresses, email addresses and domain names that have a
  known top level domain or come after a protocol like https://. An email
  address only needs a top level domain of 2 to 8 letters, in any case. Each
  dot in a name that would be linked gets an invisible word joiner after it,
  which Telegram does not count as part of a link. Other text is not changed.

  Top level domains are the IANA list from the tlds npm package 1.261.0, plus
  onion and ton, which Telegram also links.

  {
    text: <Text String>
  }

  @returns
  {
    text: <Text String>
  }
*/
module.exports = ({text}) => {
  const unlinked = text.replace(domains, (domain, start) => {
    const parts = domain.replace(edgeDots, String()).split('.');

    const [tld] = parts.slice(-1);

    const lower = tld.toLowerCase();

    // Telegram does not link a TLD with only its first letter capitalized
    const isCapitalized = lower !== tld && lower.slice(1) === tld.slice(1);

    const before = text.slice(0, start);

    // An email address only needs a top level domain of 2 to 8 letters
    const isEmail = emailUser.test(before) && emailTld.test(tld);
    const isIp = parts.length === ipAddressParts && parts.every(isIpNumber);
    const isTld = !isCapitalized && (tlds.has(lower) || punycode.test(tld));
    const isUrl = protocol.test(before);

    // Exit early when Telegram would not link this domain
    if (parts.length < 2 || (!isEmail && !isIp && !isTld && !isUrl)) {
      return domain;
    }

    return domain.replace(innerDots, `.${wordJoiner}`);
  });

  return {text: unlinked};
};
