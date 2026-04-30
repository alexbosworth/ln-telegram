const {equal} = require('node:assert').strict;
const test = require('node:test');

const {handleMempoolCommand} = require('./../../');

test('Mempool command accepts a mempool blocks URL argument', async () => {
  const mempoolBlocksUrl = 'https://example.com/api/v1/fees/mempool-blocks';
  let requestedUrl;

  await handleMempoolCommand({
    from: 1,
    id: 1,
    mempool_blocks_url: mempoolBlocksUrl,
    reply: () => {},
    request: ({url}, cbk) => {
      requestedUrl = url;

      return cbk(null, {statusCode: 200}, [{
        blockVSize: 1,
        medianFee: 1,
      }]);
    },
  });

  equal(requestedUrl, mempoolBlocksUrl, 'Requested configured mempool URL');

  return;
});
