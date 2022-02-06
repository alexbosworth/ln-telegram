# Versions

## Version 3.14.2

- `postClosedMessage`, `postOpenMessage`: upgrade to MarkdownV2

## Version 3.14.0

- `handleGraphCommand`: Add method to lookup a node in the network graph

## Version 3.13.0

- `handleStopCommand`: Add method to handle the bot stop command

## Version 3.12.1

- `handleStartCommand`: Add method to handle the bot start button command

## Version 3.11.0

- `handleEditedMessage`: Add method to handle editing of a past message

## Version 3.10.0

- `postCreatedTrade`: Add support for moving a trade-secret to another node

## Version 3.9.0

- `postCreatedTrade`: Add support for setting a trade-secret expiration date

## Version 3.8.1

Add support for changing trade-secret descriptions

- `actOnMessageReply`: Change method name of `updateInvoiceFromReply`
- `isMessageReplyAction`: Change method name of `isMessageReplyToInvoice`

## Version 3.7.0

- `postCreatedTrade`: Add support for deleting a created trade-secret

## Version 3.6.0

- `postCreatedTrade`: Add method to post a created trade-secret
- `postSettledTrade`: Add method to post a settled trade-secret

## Version 3.5.1

- `handleButtonPush`: Add method to handle button pushes
- `handleInvoiceCommand`: Redesign interface to use buttons
- `isMessageReplyToInvoice`: Add method to test if reply is reply to invoice
- `updateInvoiceFromReply`: Add method to update a created invoice from a reply

## Version 3.4.3

- `postSettledPayment`: Add method to post a settled payment to the bot

## Version 3.3.2

- `handleCostsCommand`: Correct week chain fee summary

## Version 3.3.0

- `handleCostsCommand`: Add command to show rebalance and chain fee costs

## Version 3.2.11

- `handleBackupCommand`: Swap `request` argument for `send` to use native send file
- `postUpdatedBackup`: Swap `request` argument for `send` to use native send file

## Version 3.2.10

- `handlePendingCommand`: Add check on from and id before pending lookups

## Version 3.2.9

- `handlePayCommand`: Fix issue paying requests that require the payment nonce

## Version 3.2.8

- `notifyOfForwards`: Combine forwards within the same pair

## Version 3.2.7

Remove momentjs dependency

- Change formatting for forward, rebalance, received messages

## Version 3.2.5

- `handleConnectCommand`: Fix missing reference to already connected message

## Version 3.2.2

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
