# Versions

## Version 6.1.2

- `handleEarningsCommand`: Support large numbers of forwards

## Version 6.1.0

- Add support for indicating if a channel is unannounced in opening message

## Version 6.0.0

- Add support for `PREFERRED_TOKENS_TYPE=rounded` to adjust amount formatting

### Breaking Changes

- Node 18 or higher is now required

## Version 5.0.0

### Breaking Changes

- Node 16 or higher is now required

## Version 4.6.1

- `postSettledPayment`: Show outgoing hop forwarding alias for sent payments

## Version 4.5.1

- `postSettledInvoice`: Add argument `min_rebalance_tokens` to constrain posts

## Version 4.4.0

- `handleBalanceCommand`: Show balance of funds on the node

## Version 4.3.1

- `postSettledInvoice`: Show forwarding alias for received payments

## Version 4.2.0

- `handleGraphCommand`: Support multiple words in node queries
- `handleInvoiceCommand`: Support multiple words in peer queries

## Version 4.1.0

- `actOnMessageReply`, `handleInvoiceCommand`: Add support for specifying
    amount as a formula, including fiat amounts

## Version 4.0.0

- `handleButtonPush`: Fix crash when an unknown button push event is received

### Breaking Changes

- End support for node.js 12, versions 14 or higher are now required

## Version 3.22.5

- `postSettledInvoice`: Use mtokens precision in rebalance messages

## Version 3.22.2

- `handleLiquidityCommand`: Add support for showing fee rates

## Version 3.21.6

- `handleGraphCommand`: Increase error catching guards on channels summary

## Version 3.21.4

- `handleGraphCommand`: Add latest channels summary to node info

## Version 3.21.3

- Disallow non-connected users from accessing /version and /mempool commands

## Version 3.21.1

- Add support for showing complete amounts in forwarding messages

## Version 3.20.0

- Add support for `PREFERRED_TOKENS_TYPE=full` to adjust amount formatting

## Version 3.19.2

- `handleStopCommand`: Add confirmation to avoid accidental termination

## Version 3.19.1

- `postSettledInvoice`: Add support for showing balanced open proposals

## Version 3.18.0

- `handleInfoCommand`: Add method to get node wallet info

## Version 3.17.6

- `handleBlocknotifyCommand`: Add access checking on command invocation

## Version 3.17.5

- `handleBackupCommand`, `handleInvoiceCommand`: Handle posting wrong user err

## Version 3.17.4

- `handleLiquidityCommand`: Handle scenario where no liquidity exists

## Version 3.17.1

- `postNodesOffline`: Add method to notify of nodes going offline
- `postNodesOnline`: Add method to notify of nodes connected

## Version 3.16.0

- `postClosingMessage`: Add method to notify of a new pending closing channel

## Version 3.15.2

- `postOpeningMessage`: Add method to notify of a new opening channel

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
