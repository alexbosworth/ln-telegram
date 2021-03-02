const moment = require('moment');

const {bot} = require('./../interaction');

const blocksAsEpoch = blocks => Date.now() + blocks * 1000 * 60 * 10;
const flatten = arr => [].concat(...arr);
const fromNow = epoch => !epoch ? undefined : moment(epoch).fromNow();
const nodeAlias = (alias, id) => `${alias} ${id.substring(0, 8)}`.trim();
const sumOf = arr => arr.reduce((sum, n) => sum + n, Number());
const uniq = arr => Array.from(new Set(arr));

/** Notify of pending channels and HTLCs

  {
    htlcs: [{
      forwarding: [{
        fee: <Routing Fee Tokens Number>
        in_peer: <Inbound Peer Public Key Hex String>
        out_peer: <Outbound Peer Public Key Hex String>
        tokens: <Routing Tokens Number>
      }]
      from: <From Node Named String>
      nodes: [{
        alias: <Node Alias String>
        id: <Public Key Hex String>
      }]
      sending: [{
        out_peer: <Outbound Peer Public Key Hex String>
      }]
    }]
    pending: [{
      closing: [{
        partner_public_key: <Peer Public Key Hex String>
        pending_balance: <Pending Balance Tokens Number>
        timelock_expiration: <Funds Locked Until Height Number>
      }]
      from: <From Node Named String>
      height: <Current Block Height Number>
      nodes: [{
        alias: <Node Alias String>
        id: <Public Key Hex String>
      }]
      opening: [{
        is_partner_initiated: <Opening Channel is Peer Initiated Bool>
        local_balance: <Opening Channel Local Balance Tokens Number>
        partner_public_key: <Opening Channel With Public Key Hex String>
        remote_balance: <Opening Channel Remote Balance Tokens Number>
        transaction_fee: <Commitment Transaction Fee Tokens Number>
        transaction_id: <Funding Transaction Id Hex String>
      }]
    }]
    reply: <Reply to Bot Function>
  }
*/
module.exports = ({htlcs, pending, reply}) => {
  // Pending closing and opening channels
  const channels = pending.map(node => {
    // Opening channels, waiting for confirmation
    const openingChannels = node.opening
      .map(opening => {
        const direction = !!opening.is_partner_initiated ? 'in' : 'out';
        const funds = [opening.local_balance, opening.remote_balance];
        const peerId = opening.partner_public_key;
        const tx = opening.transaction_id;

        const capacity = sumOf(funds.concat(opening.transaction_fee));
        const peer = node.nodes.find(n => n.id === peerId);

        const action = `${direction}bound ${capacity} channel`;
        const alias = nodeAlias(peer.alias, peer.id);

        return `Waiting for ${action} with ${alias} to confirm: ${tx}`;
      });

    // Closing channels, waiting for coins to return
    const waitingOnFunds = node.closing
      .filter(n => !!n.timelock_expiration && !!n.pending_balance)
      .filter(n => n.timelock_expiration > node.height)
      .map(closing => {
        const funds = closing.pending_balance;
        const peerId = closing.partner_public_key;
        const waitBlocks = closing.timelock_expiration - node.height;

        const peer = node.nodes.find(n => n.id === peerId);
        const time = fromNow(blocksAsEpoch(waitBlocks));

        const action = `recover ${funds} ${time} from closing channel`;
        const alias = nodeAlias(peer.alias, peer.id);

        return `Waiting to ${action} with ${alias}`;
      });

    return {
      from: node.from,
      channels: flatten([].concat(openingChannels).concat(waitingOnFunds)),
    };
  });

  // HTLCs in flight for probing or for forwarding
  const payments = htlcs.map(node => {
    // Forwarding an HTLC in one peer and out another
    const forwarding = node.forwarding.map(forward => {
      const fee = forward.fee;
      const from = node.nodes.find(n => n.id === forward.in_peer);
      const to = node.nodes.find(n => n.id === forward.out_peer);
      const tokens = forward.tokens;

      const action = `${tokens} for ${fee} fee`;
      const inPeer = nodeAlias(from.alias, from.id);
      const outPeer = nodeAlias(to.alias, to.id);

      return `Forwarding ${action} from ${inPeer} to ${outPeer}`;
    });

    // Probing out peers
    const probes = uniq(node.sending.map(n => n.out_peer)).map(key => {
      const out = node.nodes.find(n => n.id === key);

      return nodeAlias(out.alias, out.id);
    });

    const probing = !probes.length ?
      [] : [`Probing out ${probes.join(', ')}`];

    return {from: node.from, payments: [].concat(forwarding).concat(probing)};
  });

  // Notify of pending channels
  channels.forEach(node => {
    if (!node.channels.length) {
      return reply(`${bot} ${node.from}: No pending channels.`);
    }

    const summary = [].concat(`⏳ ${node.from}:`).concat(node.channels);

    return reply(summary.join('\n'));
  });

  // Notify of pending payments
  payments
    .filter(n => !!n.payments.length)
    .forEach(node => {
      const summary = [].concat(`💸 ${node.from}:`).concat(node.payments);

      return reply(summary.join('\n'));
    });

  return;
};
