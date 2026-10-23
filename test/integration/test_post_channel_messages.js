const {deepEqual} = require('node:assert').strict;
const test = require('node:test');

const asyncRetry = require('async/retry');
const {closeChannel} = require('ln-service');
const {getNode} = require('ln-service');
const {setupChannel} = require('ln-docker-daemons');
const {spawnLightningCluster} = require('ln-docker-daemons');
const {subscribeToChannels} = require('ln-service');

const {postClosedMessage} = require('./../../');
const {postOpenMessage} = require('./../../');

const capacity = 1e6;
const from = 'control';
const id = 1;
const interval = 100;
const send = async () => {};
const sentence = ({text}) => text.split(' Inbound liquidity')[0];
const size = 2;
const times = 1500;

// Channel opens and closes should be posted with who opened and closed them
test(`Post channel messages`, async () => {
  // The cluster channel keeps the target in the graph as channels close
  const {kill, nodes} = await spawnLightningCluster({capacity, size});

  const [control, target] = nodes;

  const closed = [];
  const opened = [];
  const sub = subscribeToChannels({lnd: control.lnd});

  sub.on('channel_closed', update => closed.push(update));
  sub.on('channel_opened', update => opened.push(update));
  sub.on('error', () => {});

  // Wait for the control node to get an update about a channel
  const updateFor = async ({channel, generate, updates}) => {
    return await asyncRetry({interval, times}, async () => {
      // Make blocks while waiting when the update needs a confirmation
      if (!!generate) {
        await generate({});
      }

      const update = updates.find(candidate => {
        const isOutpoint = candidate.transaction_id === channel.transaction_id;

        return isOutpoint &&
          candidate.transaction_vout === channel.transaction_vout;
      });

      if (!update) {
        throw new Error('ExpectedChannelUpdate');
      }

      return update;
    });
  };

  // Post a channel opened update the same way bos does
  const postOpen = async update => {
    return await postOpenMessage({
      from,
      id,
      send,
      capacity: update.capacity,
      is_partner_initiated: update.is_partner_initiated,
      is_private: update.is_private,
      lnd: control.lnd,
      partner_public_key: update.partner_public_key,
    });
  };

  // Post a channel closed update the same way bos does
  const postClosed = async update => {
    return await postClosedMessage({
      from,
      id,
      send,
      capacity: update.capacity,
      is_breach_close: update.is_breach_close,
      is_cooperative_close: update.is_cooperative_close,
      is_local_force_close: update.is_local_force_close,
      is_partner_closed: update.is_partner_closed,
      is_remote_force_close: update.is_remote_force_close,
      lnd: control.lnd,
      partner_public_key: update.partner_public_key,
    });
  };

  try {
    // Wait for the target to show up in the control graph with an alias
    const {alias} = await asyncRetry({interval, times}, async () => {
      const node = await getNode({lnd: control.lnd, public_key: target.id});

      if (!node.alias) {
        throw new Error('ExpectedNodeAliasFoundInGraph');
      }

      return node;
    });

    const peer = `${alias} \`${target.id}\`\\.`;

    // The target opens a channel to the control node
    const inbound = await setupChannel({
      generate: target.generate,
      lnd: target.lnd,
      to: control,
    });

    const accepted = await updateFor({channel: inbound, updates: opened});

    deepEqual(
      sentence(await postOpen(accepted)),
      `🌹 Accepted new 0\\.01000000 channel from ${peer}`,
      'Channel opened by the peer is posted'
    );

    // The control node opens a channel to the target
    const outbound = await setupChannel({
      generate: control.generate,
      lnd: control.lnd,
      to: target,
    });

    const opening = await updateFor({channel: outbound, updates: opened});

    deepEqual(
      sentence(await postOpen(opening)),
      `🌹 Opened new 0\\.01000000 channel to ${peer}`,
      'Channel opened by the node is posted'
    );

    // The target cooperatively closes the channel it opened
    await closeChannel({
      lnd: target.lnd,
      transaction_id: inbound.transaction_id,
      transaction_vout: inbound.transaction_vout,
    });

    const peerClose = await updateFor({
      channel: inbound,
      generate: control.generate,
      updates: closed,
    });

    deepEqual(
      sentence(await postClosed(peerClose)),
      `🥀 0\\.01000000 channel was cooperatively closed by ${peer}`,
      'Channel closed by the peer is posted'
    );

    // The control node cooperatively closes the channel it opened
    await closeChannel({
      lnd: control.lnd,
      transaction_id: outbound.transaction_id,
      transaction_vout: outbound.transaction_vout,
    });

    const nodeClose = await updateFor({
      channel: outbound,
      generate: control.generate,
      updates: closed,
    });

    deepEqual(
      sentence(await postClosed(nodeClose)),
      `🥀 Cooperatively closed 0\\.01000000 channel with ${peer}`,
      'Channel closed by the node is posted'
    );
  } catch (err) {
    deepEqual(err, null, 'Expected no error');
  } finally {
    sub.removeAllListeners();

    await kill({});
  }

  return;
});
