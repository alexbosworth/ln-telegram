const {handleBackupCommand} = require('./commands');
const {handleBlocknotifyCommand} = require('./commands');
const {handleConnectCommand} = require('./commands');
const {handleInvoiceCommand} = require('./commands');
const {handleLiquidityCommand} = require('./commands');
const {handleMempoolCommand} = require('./commands');
const {handlePayCommand} = require('./commands');
const {postChainTransaction} = require('./post');
const {postClosedMessage} = require('./post');
const {postForwardedPayments} = require('./post');
const {postOpenMessage} = require('./post');
const {postSettledInvoice} = require('./post');
const {postUpdatedBackups} = require('./post');
const {sendMessage} = require('./post');

module.exports = {
  handleBackupCommand,
  handleBlocknotifyCommand,
  handleConnectCommand,
  handleInvoiceCommand,
  handleLiquidityCommand,
  handleMempoolCommand,
  handlePayCommand,
  postChainTransaction,
  postClosedMessage,
  postForwardedPayments,
  postOpenMessage,
  postSettledInvoice,
  postUpdatedBackups,
  sendMessage,
};
