const chanInfoResponse = require('./chan_info_response');
const chanInfoResult = require('./chan_info_result');
const getInfoResponse = require('./get_info_response');
const getNodeInfoResponse = require('./get_node_info_response');
const listChannelsResponse = require('./list_channels_response');
const nodeInfoResult = require('./node_info_result');
const pendingChannelsResponse = require('./pending_channels_response');
const versionInfo = require('./version_info');

module.exports = {
  chanInfoResponse,
  chanInfoResult,
  getInfoResponse,
  getNodeInfoResponse,
  listChannelsResponse,
  nodeInfoResult,
  pendingChannelsResponse,
  versionInfo,
};