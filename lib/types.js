'use strict';

const Gql = require('graphql-tag');
const CloneDeep = require('lodash.clonedeep');

const debug = require('debug')('graphql-component:types');

const check = function (operation, fieldName, excludes) {
  for (const [root, name] of excludes) {
    if (root === '*') {
      return true;
    }
    return operation === root && (name === '' || name === '*' || name === fieldName);
  }
}

const exclude = function (types, excludes) {
  if (!excludes || excludes.length < 1) {
    return types;
  }

  const typesCopy = CloneDeep(types);

  for (const doc of typesCopy) {
    for (const def of doc.definitions) {
      if (def.kind !== 'ObjectTypeDefinition') {
        continue;
      }
      if (['Query', 'Mutation', 'Subscription'].indexOf(def.name.value) > -1) {
        def.fields = def.fields.filter((field) => {
          if (check(def.name.value, field.name.value, excludes)) {
            debug(`excluding ${def.name.value}.${field.name.value} from import`);
            return false;
          }
          return true;
        });
      }
    }
  }

  return typesCopy;
}

const getImportedTypes = function (component, excludes) {
  const types = component._types.map((type) => Gql`${type}`);
  const importedTypes = component._importedTypes;
  return exclude([...types, ...importedTypes], excludes);
};

module.exports = { exclude, check, getImportedTypes };
