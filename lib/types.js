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

const excludeImmutable = function (types, excludes) {
  if (!excludes || excludes.length < 1) {
    return types;
  }

  let mutations = [];

  for (let typeIndex = 0; typeIndex < types.length; typeIndex++) {
    const doc = types[typeIndex];
    for (let defIndex = 0; defIndex < doc.definitions.length; defIndex++) {
      const def = doc.definitions[defIndex];
      if (def.kind !== 'ObjectTypeDefinition') {
        continue;
      }
      if (['Query', 'Mutation', 'Subscription'].indexOf(def.name.value) > -1) {
        let fields = def.fields.filter((field) => {
          if (check(def.name.value, field.name.value, excludes)) {
            debug(`excluding ${def.name.value}.${field.name.value} from import`);
            return false;
          }
          return true;
        });

        if (fields.length !== def.fields.length) {
          mutations.push({
            typeIndex,
            defIndex,
            fields
          });
        }
      }
    }
  }

  for (const mutation of mutations) {
    const doc = types[mutation.typeIndex];
    const definition = doc.definitions[mutation.defIndex];

    const newDefinitions = [
      ...doc.definitions
    ];
    newDefinitions[mutation.defIndex] = {
      ...definition,
      fields: mutation.fields
    };

    types[mutation.typeIndex] = {
      ...doc,
      definitions: newDefinitions
    };
  }

  return types;
}

const getImportedTypes = function (component, excludes) {
  const types = component._types.map((type) => Gql`${type}`);
  const importedTypes = component._importedTypes;
  return excludeImmutable([...types, ...importedTypes], excludes);
};

module.exports = { exclude, check, getImportedTypes };
