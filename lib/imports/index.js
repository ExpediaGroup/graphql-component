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
    // iterate through the definitions backwards - such that in the case
    // where we need to modify the definitions array itself, everything
    // stays in sync
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

const importDirectives = function (typedefDocuments, component, importedDirectives) {
  const { directives: componentDirectives } = component;
  const result = {};

  for (let [directiveName, directiveImplementation] of Object.entries(componentDirectives)) {
    // conflict detected - namespace the current component's directive
    if (importedDirectives[directiveName]) {
      const newDirectiveName = `${directiveName}_${component.id}`;
      for (let document of typedefDocuments) {
        for (let definition of document.definitions) {
          namespaceDirectiveInAST(definition, directiveName, newDirectiveName);
        }
      }
      result[newDirectiveName] = directiveImplementation;
    }
    else {
      result[directiveName] = directiveImplementation;
    }
  }

  return result;
}

// has side effects - modifies the input astNode 
const namespaceDirectiveInAST = function (astNode, originalDirectiveName, newDirectiveName) {
  // base case
  if ((astNode.kind === 'DirectiveDefinition' || astNode.kind === 'Directive') && astNode.name.value === originalDirectiveName) {
    astNode.name.value = newDirectiveName;
  }

  if (astNode.directives && astNode.directives.length > 0) {
    for (let directiveNode of astNode.directives) {
      namespaceDirectiveInAST(directiveNode, originalDirectiveName, newDirectiveName);
    }
  }

  if (astNode.fields && astNode.fields.length > 0) {
    for (let fieldNode of astNode.fields) {
      namespaceDirectiveInAST(fieldNode, originalDirectiveName, newDirectiveName);
    }
  }
}

const checkForDirectiveImplementations = function (typeDefDocuments, component) {
  const { directives } = component;
  for (let document of typeDefDocuments) {
    for (let typedef of document.definitions) {
      if (typedef.kind === 'DirectiveDefinition') {
        if (!directives[typedef.name.value]) {
          throw new Error(`${component.name} defined directive: @${typedef.name.value} but did not provide an implementation`);
        }
      }
    }
  }
}

const buildDependencyTree = function (root) {
  const importedTypes = [];
  const importedResolvers = [];
  const importedMocks = [];
  let importedDirectives = {};

  const visited = new Set();
  const queue = [{component: root}];
  
  while (queue.length > 0) {
    const current = queue.shift();

    const { component, exclude } = current;

    if (visited.has(component.id)) {
      continue;
    }

    const excludes = parseExclude(exclude);

    // import types
    const types = filterTypes(component.types.map((type) => graphql.parse(type)), excludes);
    importedTypes.unshift(...types);

    // import diretives
    checkForDirectiveImplementations(types, component);

    if (Object.keys(component.directives).length > 0 && Object.keys(importedDirectives).length > 0) {
      const importedComponentDirectives = importDirectives(types, component, importedDirectives);
      importedDirectives = { ...importedDirectives, ...importedComponentDirectives };
    }
    else {
      importedDirectives = { ...importedDirectives, ...component.directives };
    }

    // import resolvers from imported component
    const resolvers = importResolvers(component, excludes);

    if (Object.keys(resolvers).length) {
      importedResolvers.unshift(resolvers);
    }

    // imports mocks from imported component
    if (component.mocks) {
      importedMocks.unshift(component.mocks);
    }

    visited.add(component.id);

    // update exclude for imported components
    if (exclude && exclude.length && component.imports) {
        component.imports.forEach((importedComponent) => {
            const importExclude = importedComponent.exclude;
            if (!importExclude) {
              importedComponent.exclude = exclude;
            } else {
              exclude.forEach((exc) => {
                if (!importExclude.includes(exc)) {
                  importedComponent.exclude.push(exc);
                }
              })
            }
        });
    }

    queue.push(...component.imports);
  }

  return { importedTypes, importedResolvers, importedMocks, importedDirectives };
};

module.exports = { buildDependencyTree, filterTypes };