const asyncAuto = require('async/auto');
const {decodePaymentRequest} = require('ln-service');
const {getIdentity} = require('ln-service');
const {formatTokens} = require('ln-sync');
const {getNodeAlias} = require('ln-sync');
const {returnResult} = require('asyncjs-util');
const {verifyBytesSignature} = require('ln-service');

const asBigUnit = tokens => (tokens / 1e8).toFixed(8);
const balancedOpenType = '80501';
const bufFromHex = hex => Buffer.from(hex, 'hex');
const capacityType = '80502';
const dash = ' - ';
const dateType = '34349343';
const escape = text => text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\\$&');
const fromKeyType = '34349339';
const hexAsUtf8 = hex => Buffer.from(hex, 'hex').toString('utf8');
const hexFromBuf = buffer => buffer.toString('hex');
const {isArray} = Array;
const maxAnswer = BigInt(80518);
const messageType = '34349334';
const minAnswer = BigInt(80509);
const newLine = '\n';
const parseHexNumber = hex => parseInt(hex, 16);
const signatureType = '34349337';
const sort = (a, b) => (a < b) ? -1 : ((a > b) ? 1 : 0);

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
    [quiz]: [<Quiz Answer String>]
    [title]: <Sender Message String>
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

        const quizAnswers = messages
          .filter(({type}) => {
            return BigInt(type) >= minAnswer && BigInt(type) <= maxAnswer;
          })
          .sort((a, b) => sort(BigInt(a.type), BigInt(b.type)))
          .map(({value}) => hexAsUtf8(value));

        const messageRecord = messages.find(({type}) => type === messageType);
        const balancedOpenRecord = messages.find(({type}) => type === balancedOpenType);

        // Exit early when there is no message type record
        if (!messageRecord && !balancedOpenRecord) {
          return cbk();
        }

        return cbk(null, {
          capacity: messages.find(({type}) => type === capacityType),
          date: messages.find(({type}) => type === dateType),
          from: messages.find(({type}) => type === fromKeyType),
          message: messageRecord || balancedOpenRecord,
          quiz: quizAnswers,
          signature: messages.find(({type}) => type === signatureType),
        });
      }],

      // Description of the received amount
      receiveLine: ['validate', ({}, cbk) => {
        const quoted = !description ? '' : `for “${description}”`;

        return cbk(null, `Received ${asBigUnit(received)} ${quoted}`.trim());
      }],

      // Get the node public key for signature verification puroses
      getPublicKey: ['messageDetails', ({messageDetails}, cbk) => {
        if (!messageDetails || !messageDetails.signature) {
          return cbk();
        }

        return getIdentity({lnd}, cbk);
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

      //Parse payment request
      parseBalancedOpen: ['messageDetails', async ({messageDetails}) => {
        // Exit early when there is no message record
        if (!messageDetails || !messageDetails.message) {
          return;
        }

        const request = bufFromHex(messageDetails.message.value).toString();

        try {
          const {destination} = await decodePaymentRequest({lnd, request});

          const {alias} = await getNodeAlias({lnd, id: destination});

          const parsedCapacity = parseHexNumber(messageDetails.capacity.value);
          const capacity = formatTokens({tokens: parsedCapacity}).display;

          return {alias, destination, capacity};
          //ignore errors if any
        } catch (err) {
          return;
        }
      }],

      // Received message
      receivedMessage: [
        'getFromNode',
        'isSignatureValid',
        'messageDetails',
        'parseBalancedOpen',
        'receiveLine',
        ({getFromNode, isSignatureValid, messageDetails, parseBalancedOpen, receiveLine}, cbk) =>
      {
        //Exit early if its a balanced open
        if (!!parseBalancedOpen) {
          return cbk();
        }
        // Exit early when there is no associated message
        if (!messageDetails || !messageDetails.message) {
          return cbk(null, receiveLine);
        }

        const senderMsg = bufFromHex(messageDetails.message.value).toString();

        const senderLine = `Sender message: “${senderMsg}”`;

        // Exit early when there is no from key
        if (!messageDetails.from) {
          return cbk(null, [receiveLine, senderLine].join(dash));
        }

        const from = getFromNode.alias || getFromNode.id;

        // Exit early when there is a from key but it's not verified
        if (!isSignatureValid) {
          const fromLine = `Marked as from: ${from} (unverified/unsigned)`;

          return cbk(null, [receiveLine, senderLine, fromLine].join(dash));
        }

        const signedLine = `From: ${from}`;

        return cbk(null, [receiveLine, senderLine, signedLine].join(dash));
      }],

      // Final received message
      message: [
        'messageDetails',
        'parseBalancedOpen',
        'receivedMessage',
        ({messageDetails, parseBalancedOpen, receivedMessage}, cbk) =>
      {
        if (!!parseBalancedOpen) {
          const id = parseBalancedOpen.destination;
          const capacity = escape(parseBalancedOpen.capacity);
          const alias = escape(parseBalancedOpen.alias) || id.substring(0, 8);

          const message = `Received a ${capacity} balanced channel open request from ${alias} \`${id}\``;

          return cbk(null, {
            message,
            is_balanced_open: true,
          });
        }

        if (!receivedMessage) {
          return cbk(null, {});
        }

        if (!messageDetails) {
          return cbk(null, {message: escape(receivedMessage)});
        }

        return cbk(null, {
          message: escape(receivedMessage),
          quiz: messageDetails.quiz,
          title: bufFromHex(messageDetails.message.value).toString(),
        });
      }],
    },
    returnResult({reject, resolve, of: 'message'}, cbk));
  });
};
