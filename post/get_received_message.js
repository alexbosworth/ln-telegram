const asyncAuto = require('async/auto');
const {getNodeAlias} = require('ln-sync');
const {getWalletInfo} = require('ln-service');
const {returnResult} = require('asyncjs-util');
const {verifyBytesSignature} = require('ln-service');

const bufFromHex = hex => Buffer.from(hex, 'hex');
const dateType = '34349343';
const fromKeyType = '34349339';
const hexFromBuf = buffer => buffer.toString('hex');
const {isArray} = Array;
const messageType = '34349334';
const newLine = '\n';
const signatureType = '34349337';

/** Get received message

  {
    description: <Invoice Description String>
    lnd: <Authenticated LND API Object>
    payments: [{
      messages: [{
        type: <Message Record TLV Type String>
        value: <Message Record Value Hex String>
      }]
    }]
    received: <Received Tokens Number>
  }

  @returns via cbk or Promise
  {
    [message]: <Embedded Message Payment Received String>
  }
*/
module.exports = ({description, lnd, payments, received}, cbk) => {
  return new Promise((resolve, reject) => {
    return asyncAuto({
      // Check arguments
      validate: cbk => {
        if (description === undefined) {
          return cbk([400, 'ExpectedInvoiceDescriptionToGetReceiveMessage']);
        }

        if (!lnd) {
          return cbk([400, 'ExpectedAuthenticatedLndToGetReceiveMessage']);
        }

        if (!isArray(payments)) {
          return cbk([400, 'ExpectedArrayOfReceivePaymentsForReceiveMessage']);
        }

        return cbk();
      },

      // Derive the message details
      messageDetails: ['validate', ({}, cbk) => {
        // Exit early when there are no TLV records
        if (!payments.length) {
          return cbk();
        }

        const [{messages}] = payments;

        const messageRecord = messages.find(({type}) => type === messageType);

        // Exit early when there is no message type record
        if (!messageRecord) {
          return cbk();
        }

        return cbk(null, {
          date: messages.find(({type}) => type === dateType),
          from: messages.find(({type}) => type === fromKeyType),
          message: messageRecord,
          signature: messages.find(({type}) => type === signatureType),
        });
      }],

      // Description of the received amount
      receiveLine: ['validate', ({}, cbk) => {
        const quoted = !description ? '' : `for “${description}”`;

        return cbk(null, `Received ${received} ${quoted}`);
      }],

      // Get the node public key for signature verification puroses
      getPublicKey: ['messageDetails', ({messageDetails}, cbk) => {
        if (!messageDetails || !messageDetails.signature) {
          return cbk();
        }

        return getWalletInfo({lnd}, cbk);
      }],

      // Determine if the message signature is valid
      isSignatureValid: [
        'getPublicKey',
        'messageDetails',
        ({getPublicKey, messageDetails}, cbk) =>
      {
        // Exit early when there is no signed message record
        if (!messageDetails || !messageDetails.signature) {
          return cbk();
        }

        // Exit early when the message signing details are not set
        if (!messageDetails.from || !messageDetails.date) {
          return cbk();
        }

        const preimage = Buffer.concat([
          bufFromHex(messageDetails.from.value),
          bufFromHex(getPublicKey.public_key),
          bufFromHex(messageDetails.date.value),
          bufFromHex(messageDetails.message.value),
        ]);

        return verifyBytesSignature({
          lnd,
          preimage: hexFromBuf(preimage),
          public_key: messageDetails.from.value,
          signature: messageDetails.signature.value,
        },
        (err, res) => {
          // Ignore errors
          if (!!err) {
            return cbk();
          }

          return cbk(null, !!res.is_valid);
        });
      }],

      // Get the "from" node alias
      getFromNode: ['messageDetails', ({messageDetails}, cbk) => {
        // Exit early when there is no from node to look up
        if (!messageDetails || !messageDetails.from) {
          return cbk();
        }

        return getNodeAlias({lnd, id: messageDetails.from.value}, cbk);
      }],

      // Received message
      receivedMessage: [
        'getFromNode',
        'isSignatureValid',
        'messageDetails',
        'receiveLine',
        ({getFromNode, isSignatureValid, messageDetails, receiveLine}, cbk) =>
      {
        // Exit early when there is no associated message
        if (!messageDetails || !messageDetails.message) {
          return cbk(null, receiveLine);
        }

        const senderMsg = bufFromHex(messageDetails.message.value).toString();

        const senderLine = `Sender message: “${senderMsg}”`;

        // Exit early when there is no from key
        if (!messageDetails.from) {
          return cbk(null, [receiveLine, senderLine].join(newLine));
        }

        const from = getFromNode.alias || getFromNode.id;

        // Exit early when there is a from key but it's not verified
        if (!isSignatureValid) {
          const fromLine = `Marked as from: ${from} (unverified/unsigned)`;

          return cbk(null, [receiveLine, senderLine, fromLine].join(newLine));
        }

        const signedLine = `From: ${from}`;

        return cbk(null, [receiveLine, senderLine, signedLine].join(newLine));
      }],

      // Final received message
      message: ['receivedMessage', ({receivedMessage}, cbk) => {
        return cbk(null, {message: receivedMessage});
      }],
    },
    returnResult({reject, resolve, of: 'message'}, cbk));
  });
};
