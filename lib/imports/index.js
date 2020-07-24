'use strict';

const graphql = require('graphql');
const { importResolvers } = require('../resolvers');

const debug = require('debug')('graphql-component:imports');

const parseExclude = function (exclude) {
  const excludes = [];

  if (exclude && exclude.length > 0) {
    excludes.push(...exclude.map((filter) => filter.split('.')));
  }

  return excludes;
}

const check = function (type, fieldName, excludes) {
  return excludes.map(([root, name]) => {
    if (root === '*') {
      return true;
    }
    return type === root && (name === '' || name === '*' || name === fieldName);
  }).some(check => check);
};

const filterTypes  = function (types, excludes) {
  if (!excludes || excludes.length < 1) {
    return types;
  }
  
  for (const doc of types) {
    const { definitions } = doc;
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

const namespaceDirectives = function (rootDirectives, id, document) {
  const namespaceEach = function (list) {
    for (const definition of list) {
      if (definition.kind === 'DirectiveDefinition' || definition.kind === 'Directive') {
        if (rootDirectives[definition.name.value]) {
          const name = `${definition.name.value}_${id}`;
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

const buildDependencyTree = function (root) {
  const importedTypes = [];
  const importedResolvers = [];
  const importedMocks = []

  const visited = new Set();
  const queue = [...root.imports.map((imported) => ({ ...imported, parent: root }))]; 
  
  while (queue.length > 0) {
    const current = queue.shift();

    const { component, exclude, parent } = current;

    if (visited.has(component.id)) {
      continue;
    }

    const excludes = parseExclude(exclude);

    const rootDirectives = parent.directives;

    // import types from imported component
    const types = filterTypes(component.types.map((type) => {
      return namespaceDirectives(rootDirectives, `${component.name}_${component.id}`, graphql.parse(type))
    }), excludes);
    importedTypes.push(...types);
    
    // import resolvers from imported component
    const resolvers = importResolvers(component, excludes);
    importedResolvers.push(resolvers);

    // imports mocks from imported component
    importedMocks.push(component.mocks);
    
    visited.add(component.id);
    queue.push(...component.imports.map((imported) => ({ ...imported, parent: component })));
  }

  return { importedTypes, importedResolvers, importedMocks };
};

module.exports = { buildDependencyTree, filterTypes, namespaceDirectives };