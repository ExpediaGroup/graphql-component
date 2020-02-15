'use strict';

const { Kind } = require('graphql');

const iterateObjectTypes = function *(definitions) {
  for (const definition of definitions) {
    if (definition.kind === Kind.OBJECT_TYPE_DEFINITION && ['Query', 'Mutation', 'Subscription'].indexOf(definition.name.value) === -1) {
      yield definition;
    }
  }
};

const buildFragments = function (document) {
  const tree = {};
  const fragments = [];

  for (const { name, fields } of iterateObjectTypes(document.definitions)) {
    tree[name.value] = fields;
  }

  for (const [root, fieldDefs] of Object.entries(tree)) {
    const fields = [];
    for (const { name, type } of fieldDefs) {
      let current = type;

      // traverse depth first to handle Kind.LIST_TYPE and KIND.NON_NULL_TYPE nodes
      while (current.kind !== Kind.NAMED_TYPE) {
        current = current.type;
      }

      if (current.name && tree[current.name.value]) {
        fields.push(`${name.value} { ...All${current.name.value} }`);
        continue;
      }
      fields.push(name.value);
    }

    fragments.push(`fragment All${root} on ${root} { ${fields.join(', ')} }`);
  }

  return fragments;
};

module.exports = { buildFragments };
