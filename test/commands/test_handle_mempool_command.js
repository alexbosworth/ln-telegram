const {equal} = require('node:assert').strict;
const test = require('node:test');

const {handleMempoolCommand} = require('./../../');

const mempoolBlocksUrl = 'https://example.com/api/v1/fees/mempool-blocks';

test('Mempool command accepts a mempool blocks URL argument', async () => {
  let requestedUrl;

  await handleMempoolCommand({
    from: 1,
    id: 1,
    reply: () => {},
    request: ({url}, cbk) => {
      requestedUrl = url;

      return cbk(null, {statusCode: 200}, [{
        blockVSize: 1,
        medianFee: 1,
      }]);
    },
    url: mempoolBlocksUrl,
  });

  equal(requestedUrl, mempoolBlocksUrl, 'Requested configured mempool URL');

  return;
});
