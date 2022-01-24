const {InlineKeyboard} = require('grammy');

const {callbackCommands} = require('./../interface');
const {labels} = require('./../interface');

const nodeLabel = named => `Node: ${named}`;
const shortId = key => key.slice(0, 46);
const switchNode = id => `${callbackCommands.moveTradeNode}${id}`;

/** Create a keyboard with trade edit buttons

  {
    is_selecting: <Is Selecting A Node to Move To Bool>
    nodes: [{
      from: <Node Name String>
      public_key: <Node Identity Public Key Hex String>
    }]
  }

  @returns
  {
    markup: <Keyboard Markup Object>
  }
*/
module.exports = args => {
  const markup = new InlineKeyboard();
  const [, otherNode] = args.nodes;

  const buttons = [
    // Edit the trade description
    [
      labels.tradeMessageDescriptionButtonLabel,
      callbackCommands.setTradeDescription,
    ],
    // Edit the trade expiry
    [
      labels.tradeMessageExpiresAtLabel,
      callbackCommands.setTradeExpiresAt,
    ],
  ];

  // Add the edit buttons
  buttons.forEach(([label, command]) => markup.text(label, command));

  if (!!args.is_selecting) {
    markup.text(
      labels.tradeMessageCancelButtonLabel,
      callbackCommands.cancelTrade,
    );

    args.nodes.forEach(node => {
      return markup.row().text(
        nodeLabel(node.from),
        switchNode(shortId(node.public_key))
      );
    });
  }

  if (!args.is_selecting && !!otherNode) {
    markup.text(
      labels.tradeMessageNodeButtonLabel,
      callbackCommands.setTradeNode
    );
  }

  if (!args.is_selecting) {
    markup.text(
      labels.tradeMessageCancelButtonLabel,
      callbackCommands.cancelTrade,
    );
  }

  return {markup};
};
