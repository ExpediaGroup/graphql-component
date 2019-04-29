'use strict';

const { parse } = require('graphql');
const debug = require('debug')('graphql-component:types');

const iterateObjectTypes = function *(definitions) {
  for (const definition of definitions) {
    if (definition.kind === 'ObjectTypeDefinition' && ['Query', 'Mutation', 'Subscription'].indexOf(definition.name.value) > -1) {
      yield definition;
    }
  }
};

const check = function (operation, fieldName, excludes) {
  for (const [root, name] of excludes) {
    if (root === '*') {
      return true;
    }
    return operation === root && (name === '' || name === '*' || name === fieldName);
  }
};

const exclude = function (types, excludes) {
  if (!excludes || excludes.length < 1) {
    return types;
  }

  for (const doc of types) {
    for (const def of iterateObjectTypes(doc.definitions)) {
      def.fields = def.fields.filter((field) => {
        if (check(def.name.value, field.name.value, excludes)) {
          debug(`excluding ${def.name.value}.${field.name.value} from import`);
          return false;
        }
        return true;
      });
    }
  }

  return types;
};

const getImportedTypes = function (component, excludes) {
  const types = component.types.map((type) => parse(type));
  const importedTypes = component.importedTypes;
  return exclude([...types, ...importedTypes], excludes);
};

module.exports = { exclude, check, getImportedTypes };
