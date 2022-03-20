module.exports = (tokens) => {
  if (!tokens)
    tokens = 0;
  if (process.env.PREFERRED_TOKENS_TYPE && process.env.PREFERRED_TOKENS_TYPE == "full")
    return tokens.toLocaleString();
  else
    return (tokens / 1e8).toFixed(8);
};
