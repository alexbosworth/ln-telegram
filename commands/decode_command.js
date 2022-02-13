const asyncAuto = require('async/auto');
const {returnResult} = require('asyncjs-util');

const interaction = require('./../interaction');

const {isArray} = Array;

/** Decode the command text

  {
    help: {
      select_node_text: <Select Node Help String>
      syntax_example_text: <Syntax Example String>
    }
    nodes: [{
      from: <Node Identification String>
      lnd: <Authenticated LND gRPC API Object>
    }]
    reply: <Reply Function>
    text: <Original Command Text String>
  }

  @returns via cbk or Promise
  {
    lnd: <Authenticated LND gRPC API Object>
    params: [<Parameter String>]
  }
*/
module.exports = ({help, nodes, reply, text}, cbk) => {
  return new Promise((resolve, reject) => {
    return asyncAuto({
      // Check arguments
      validate: cbk => {
        if (!help) {
          return cbk([400, 'ExpectedHelpTextToDecodeCommand']);
        }

        if (!isArray(nodes)) {
          return cbk([400, 'ExpectedNodesWhenDecodingCommand']);
        }

        if (!reply) {
          return cbk([400, 'ExpectedReplyFunctionToDecodeCommand']);
        }

        if (!text) {
          return cbk([400, 'ExpectedCommandTextToDecodeCommand']);
        }

        return cbk();
      },

      // Decoded elements
      decoded: ['validate', ({}, cbk) => {
        const [defaultNode] = nodes;
        const elements = text.split(' ').slice(1);

        const isMulti = nodes.length > [defaultNode].length;
        const [nodeIndex] = elements;

        const selectedNode = nodes[Number(nodeIndex || 1) - 1];

        const node = !isMulti ? defaultNode : selectedNode;

        // Exit early when the node to use is unknown
        if (!node || (nodes.length > [node].length && !nodeIndex)) {
          const syntax = help.syntax_example_text.split(' ');

          syntax.splice(1, 0, '<node #>');

          const text = []
            .concat([help.select_node_text])
            .concat(nodes.map(({from}, i) => `- ${i + 1}: ${from}`))
            .concat([syntax.join(' ')]);

          reply(text.join('\n'));

          return cbk([400, 'UnknownNodeToUseForCommand']);
        }

        const params = nodes.length === 1 ? elements : elements.slice(1);

        return cbk(null, {params, lnd: node.lnd})
      }],
    },
    returnResult({reject, resolve, of: 'decoded'}, cbk));
  });
};
