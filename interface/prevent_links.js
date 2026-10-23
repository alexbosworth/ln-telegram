const preventDomainLinks = require('./prevent_domain_links');

const addJoiner = n => `${n}\u2060`;
const cashtags = /(?<![$\p{L}\p{N}_])\$(?=[A-Z]{1,8}(?![$\p{L}\p{N}_]))/gu;
const commands = /(?<![\p{L}\p{N}_/<>])\/(?=\w{1,64}(?![\p{L}\p{N}_/<>]))/gu;
const deepLinks = /(?:tg|ton|tonsite):(?=\/\/[a-z\d_-])/gi;
const hashtags = /(?<![\p{L}\p{N}_\u200c])#(?=[\p{N}_\u200c]*\p{L})/gu;
const mentions = /(?<![\p{L}\p{N}_])@(\w{2,32})(?![\p{L}\p{N}_])/gu;
const minUsernameLength = 4;
const shortUsernames = ['gif', 'nft', 'pic', 'ufc', 'vid'];

/** Prevent Telegram from turning text into links

  Telegram links text that looks like a domain name, email, IP address,
  @mention, #hashtag, $cashtag, /command or Telegram deep link. An invisible
  word joiner is put after the dots, symbols or protocol colon making a link.
  Telegram does not count a word joiner as part of a link, so the text looks
  the same but is not linked. Text that would not be linked is not changed.

  {
    [text]: <Text String>
  }

  @returns
  {
    [text]: <Text String>
  }
*/
module.exports = ({text}) => {
  // Exit early when there is no text
  if (!text) {
    return {text};
  }

  // Break up domain names and IP addresses that Telegram would link
  const withoutDomains = preventDomainLinks({text}).text;

  // Break up mentions, hashtags, cashtags and commands that would be linked
  const unlinked = withoutDomains
    .replace(mentions, (mention, username) => {
      const isShort = username.length < minUsernameLength;

      // Exit early when the username is too short to be linked
      if (isShort && !shortUsernames.includes(username.toLowerCase())) {
        return mention;
      }

      return `${addJoiner('@')}${username}`;
    })
    .replace(hashtags, addJoiner)
    .replace(cashtags, addJoiner)
    .replace(commands, addJoiner)
    .replace(deepLinks, addJoiner);

  return {text: unlinked};
};
