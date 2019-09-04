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
