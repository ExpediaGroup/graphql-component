'use strict';

const iterateObjectTypes = function *(definitions) {
  for (const definition of definitions) {
    if (definition.kind === 'ObjectTypeDefinition' && ['Query', 'Mutation', 'Subscription'].indexOf(definition.name.value) === -1) {
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
    const fields= [];

    for (const { name, type } of fieldDefs) {
      let current = type;

      if (type.kind === 'ListType') {
        current = type.type;
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
