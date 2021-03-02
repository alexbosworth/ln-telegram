# Versions

## Version 3.2.0

- `handlePendingCommand`: Add method for responding with pending channels and HTLCs

## Version 3.1.0

- `handleVersionCommand`: Add method for responding with version number
- `postSettledInvoice`: Add quiz message support

## Version 3.0.5

- `postSettledInvoice`: Fix race condition in rebalance payment
- `postSettledInvoice`: Add safeguard against unexpected data in payment record

## Version 3.0.0

- `postUpdatedBackup`: Use this method instead of `postUpdatedBackups`, which is removed

### Breaking Changes

- `postUpdatedBackups`: Method removed

## Version 2.0.0

- `notifyOfForwards`: Use this method instead of `postForwardedPayments`, which is removed
- `postSettledInvoice`: Show public key of sender even when unverified

### Breaking Changes

- `postForwardedPayments`: Method removed

## Version 1.1.0

- `handleEarningsCommand`: Add command to show node earnings

## Version 1.0.1

- `handleLiquidityCommand`: Fix outbound liquidity command

## Version 1.0.0

- `handleBackupCommand`: Add method to send backups as files
- `handleBlocknotifyCommand`: Add method to notify on new blocks
- `handleConnectCommand`: Add method to show the Telegram user id
- `handleInvoiceCommand`: Add method to create an invoice
- `handleLiquidityCommand`: Add method to show liquidity details
- `handleMempoolCommand`: Add method to show the mempool state
- `handlePayCommand`: Add method to pay an invoice
- `postChainTransaction`: Add method to post a chain transaction message
- `postClosedMessage`: Add method to post a closed channel message
- `postForwardedPayments`: Add method to monitor and post forwarding messages
- `postOpenMessage`: Add method to post a channel open message
- `postSettledInvoice`: Add method to post a received payment message
- `postUpdatedBackups`: Add method to post a backup updated message
- `sendMessage`: Add method to send an arbitrary message
