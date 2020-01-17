'use strict';

const { parse } = require('graphql');
const debug = require('debug')('graphql-component:types');

const check = function (operation, fieldName, excludes) {
  return excludes.map(([root, name]) => {
    if (root === '*') {
      return true;
    }
    return operation === root && (name === '' || name === '*' || name === fieldName);
  }).some(check => check);
};

const exclude = function (types, excludes) {
  if (!excludes || excludes.length < 1) {
    return types;
  }

  for (const doc of types) {
    const {definitions} = doc;
    // iterate through the document's definitions and apply exclusions to applicable definitions.
    // if the definition has no fields after exclusions are applied, remove the definition from the document
    // we are iterating through the definitions backwards so that when we remove a definition the
    // inner for loop's index calculation stays in sync
    for (let i = definitions.length - 1; i >= 0; --i) {
      const def = definitions[i]
      if (def.kind === 'ObjectTypeDefinition' && ['Query', 'Mutation', 'Subscription'].indexOf(def.name.value) > -1) {
        def.fields = def.fields.filter((field) => {
          if (check(def.name.value, field.name.value, excludes)) {
            debug(`excluding ${def.name.value}.${field.name.value} from import`);
            return false;
          }
          return true;
        });
        // all of the fields of this definition were removed, so remove the definition from the document
        if (def.fields.length === 0) {
          definitions.splice(i, 1);
        }
      }
    }
  }

  return types;
};

const namespaceDirectives = function (directives, id, document) {

  const namespaceEach = function (list) {
    for (const definition of list) {
      if (definition.kind === 'DirectiveDefinition' || definition.kind === 'Directive') {
        const name = `${definition.name.value}_${id}`;
        
        if (directives[definition.name.value]) {
          debug(`namespacing imported ${definition.name.value} directive as ${name}`);
          definition.name.value = name;
        }
      }
      if (definition.directives) {
        namespaceEach(definition.directives);
      }
      if (definition.fields) {
        namespaceEach(definition.fields);
      }
    }
  };
  
  namespaceEach(document.definitions);

  return document;
};

const getImportedTypes = function (parent, component, excludes) {
  const types = component._types.map((type) => namespaceDirectives(parent._directives || {}, component._id, parse(type)));
  const importedTypes = component._importedTypes;
  return exclude([...types, ...importedTypes], excludes);
};

module.exports = { exclude, check, getImportedTypes };
