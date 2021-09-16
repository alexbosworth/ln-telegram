const handleBackupCommand = require('./handle_backup_command');
const handleBlocknotifyCommand = require('./handle_blocknotify_command');
const handleConnectCommand = require('./handle_connect_command');
const handleCostsCommand = require('./handle_costs_command');
const handleEarningsCommand = require('./handle_earnings_command');
const handleInvoiceCommand = require('./handle_invoice_command');
const handleLiquidityCommand = require('./handle_liquidity_command');
const handleMempoolCommand = require('./handle_mempool_command');
const handlePayCommand = require('./handle_pay_command');
const handlePendingCommand = require('./handle_pending_command');
const handleVersionCommand = require('./handle_version_command');

module.exports = {
  handleBackupCommand,
  handleBlocknotifyCommand,
  handleConnectCommand,
  handleCostsCommand,
  handleEarningsCommand,
  handleInvoiceCommand,
  handleLiquidityCommand,
  handleMempoolCommand,
  handlePayCommand,
  handlePendingCommand,
  handleVersionCommand,
};
