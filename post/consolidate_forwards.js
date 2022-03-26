const keyForPair = n => `${n.incoming_channel}:${n.outgoing_channel}`;
const {keys} = Object;
const mtokensAsTokens = n => Number(n) / 1e3;

/** Consolidate a set of forwards to combine similar forwards together

  {
    forwards: [{
      fee_mtokens: <Forward Fee Millitokens Earned String>
      incoming_channel: <Standard Format Incoming Channel Id String>
      mtokens: <Forwarded Millitokens String>
      outgoing_channel: <Standard Format Outgoing Channel Id String>
    }]
  }

  @returns
  {
    forwards: [{
      fee: <Forward Fee Tokens Earned Number>
      incoming_channel: <Standard Format Incoming Channel Id String>
      outgoing_channel: <Standard Format Outgoing Channel Id String>
      tokens: <Forwarded Tokens Number>
    }]
  }
*/
module.exports = ({forwards}) => {
  const unique = forwards.reduce((sum, forward) => {
    const fee = mtokensAsTokens(forward.fee_mtokens);
    const tokens = mtokensAsTokens(forward.mtokens);
    const pair = keyForPair(forward);

    sum[pair] = sum[pair] || {};

    sum[pair].fee = (sum[pair].fee || Number()) + fee;
    sum[pair].incoming_channel = forward.incoming_channel;
    sum[pair].outgoing_channel = forward.outgoing_channel;
    sum[pair].tokens = (sum[pair].tokens || Number()) + tokens;

    return sum;
  },
  {});

  return {forwards: keys(unique).map(key => unique[key])};
};
