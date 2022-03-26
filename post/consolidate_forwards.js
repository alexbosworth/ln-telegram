const keyForPair = n => `${n.incoming_channel}:${n.outgoing_channel}`;
const {keys} = Object;

/** Consolidate a set of forwards to combine similar forwards together

  {
    forwards: [{
      fee: <Forward Fee Tokens Earned Number>
      incoming_channel: <Standard Format Incoming Channel Id String>
      outgoing_channel: <Standard Format Outgoing Channel Id String>
      tokens: <Forwarded Tokens Number>
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
    const pair = keyForPair(forward);

    sum[pair] = sum[pair] || {};

    sum[pair].fee = (sum[pair].fee || Number()) + Number(forward.fee_mtokens) / 1e3;
    sum[pair].incoming_channel = forward.incoming_channel;
    sum[pair].outgoing_channel = forward.outgoing_channel;
    sum[pair].tokens = (sum[pair].tokens || Number()) + Number(forward.mtokens) / 1e3;

    return sum;
  },
  {});

  return {forwards: keys(unique).map(key => unique[key])};
};
