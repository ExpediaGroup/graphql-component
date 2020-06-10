'use strict';

const debug = require('debug')('graphql-component:resolver');
const { GraphQLScalarType, Kind, execute } = require('graphql');
const { mergeResolvers } = require('graphql-toolkit');
const deepSet = require('lodash.set');

/**
 * memoizes resolver functions such that calls of an identical resolver (args/context/path) within the same request context are avoided
 * @param {string} parentType - the type whose field resolver is being 
 * wrapped/memoized
 * @param {string} fieldName -  the field on the parentType whose resolver 
 * function is being wrapped/memoized
 * @param {function} resolve - the resolver function that parentType.
 * fieldName is mapped to
 * @returns {function} a function that wraps the input resolver function and
 * whose closure scope contains a WeakMap to achieve memoization of the wrapped 
 * input resolver function
 */
const memoize = function (parentType, fieldName, resolve) {
  const _cache = new WeakMap();

  return function (_parent, args, context, info) {
    const path = info && info.path && info.path.key;
    const key = `${path}_${JSON.stringify(args)}`;

    debug(`executing ${parentType}.${fieldName}`);

    let cached = _cache.get(context);

    if (cached && cached[key]) {
      debug(`return cached result of memoized ${parentType}.${fieldName}`);
      return cached[key];
    }

    if (!cached) {
      cached = {};
    }

    const result = resolve(_parent, args, context, info);

    cached[key] = result;

    _cache.set(context, cached);

    debug(`cached ${parentType}.${fieldName}`);

    return result;
  };
};

/**
 * excludes types and/or fields on types from an input resolver map
 * @param {Object} resolvers - the resolver map to be transformed
 * @param {Array<string>} excludes - an array of exclusions in the general form 
 * of "type.field". This format supports excluding all types ('*'), an entire 
 * type and the fields it encloses ('type', 'type.', 'type.*'), and individual 
 * fields on a type ('type.somefield').
 * @returns {Object} - a new resolver map with the applied exclusions
 */
const transformResolvers = function (resolvers, excludes) {
  if (!excludes || excludes.length < 1) {
    return resolvers;
  }

  let filteredResolvers = Object.assign({}, resolvers);

  for (const [type, field] of excludes) {
    if (type === '*') {
      filteredResolvers = {};
      break;
    }
    if (!field || field === '' || field === '*') {
      delete filteredResolvers[type];
      continue;
    }
    delete filteredResolvers[type][field];
    // covers the case where all fields of a type were specified 1 by 1, which
    // should result in the entire type being removed
    if (Object.keys(filteredResolvers[type]).length === 0) {
      delete filteredResolvers[type];
    }
  }

  return filteredResolvers;
};

/**
 * binds an object context to resolver functions in the input resolver map
 * @param {Object} bind - the object context to bind to resolver functions
 * @param {Object} resolvers - the resolver map containing the resolver 
 * functions to bind
 * @returns {Object} - an object identical in structure to the input resolver 
 * map, except with resolver function bound to the input argument bind
 */
const wrapResolvers = function (bind, resolvers = {}) {
  const wrapped = {};

  for (const [type, fieldResolvers] of Object.entries(resolvers)) {
    if (fieldResolvers instanceof GraphQLScalarType) {
      wrapped[type] = fieldResolvers;
      continue;
    }

    // if the current type's resolver functions haven't been wrapped yet
    // create a fresh map to do so
    if (!wrapped[type]) {
      wrapped[type] = {};
    }

    for (const [field, resolverFunc] of Object.entries(fieldResolvers)) {
      if (wrapped[type][field]) {
        continue;
      }

      if (['Query', 'Mutation'].indexOf(type) > -1) {
        debug(`memoized ${type}.${field}`);
        wrapped[type][field] = memoize(type, field, resolverFunc.bind(bind));
      } else {
        // for types other than Query/Mutation - conditionally bind since in
        // some cases (Subscriptions and enum remaps) resolverFunc will be 
        // an object instead of a function
        wrapped[type][field] = typeof resolverFunc === 'function' ? resolverFunc.bind(bind) : resolverFunc;
      }
    }
  }
  return wrapped;
};

/**
 * helper function to extract the so-far traversed path from an info object 
 * passed to resolvers
 * @param {Object} info - the info object passed to resolvers
 * @returns {Array<String>} - the derived path from the input info object
 */
const buildPathFromInfo = function (info) {
  const path = [];
  let current = info.path;

  do {
    path.unshift(current.key);
    current = current.prev;
  }
  while (current !== undefined);

  return path;
};

const getSelectionSetForPath = function (fieldPath, selectionSet) {
  const getSelection = function (name, selections) {
    for (const selection of selections) {
      if (selection.name.value === name || selection.alias.value === name) {
        return selection;
      }
    }
  };

  let path = fieldPath.shift();
  let current = getSelection(path, selectionSet.selections);

  while (fieldPath.length > 0) {
    path = fieldPath.shift();
    current = current && getSelection(path, current.selectionSet.selections);
  }

  return current;
};

const createSubOperationForField = function (component, fieldPath, info) {
  const operation = info.operation;
  const fragments = info.fragments;

  const definitions = [];

  if (fragments) {
    for (const [, fragmentDefinition] of Object.entries(fragments)) {
      definitions.push(fragmentDefinition);
    }
  }

  const selections = getSelectionSetForPath([...fieldPath], operation.selectionSet);

  definitions.push({
    kind: Kind.OPERATION_DEFINITION,
    operation: operation.operation,
    variableDefinitions: operation.variableDefinitions,
    selectionSet: {
      kind: Kind.SELECTION_SET,
      selections: [
        selections
      ]
    }
  });

  return {
    kind: Kind.DOCUMENT,
    definitions
  };
};

const delegateToComponent = async function (component, { subPath, contextValue, info }) {
  const rootPath = buildPathFromInfo(info);
  const fieldPath = subPath !== undefined ? [...rootPath, ...subPath.split('.')] : rootPath;

  const { rootValue, variableValues } = info;
  
  const document = createSubOperationForField(component, fieldPath, info);
  
  const { data = {}, errors = [] } = await execute({ document, schema: component.schema, rootValue, contextValue, variableValues });
  
  if (errors.length > 0) {
    for (const error of errors) {
      deepSet(data, error.path, error);
    }
  }

  let result = {};

  //do not count current field resolver in path since that will exist in data result
  deepSet(result, rootPath.length > 1 ? rootPath.slice(0, rootPath.length - 1) : rootPath, data);
  
  while (fieldPath.length > 0) {
    let path = fieldPath.shift();
    result = result[path];
  }
  
  return result;
};

/**
 * returns a function that delegates execution to a resolver implementation's 
 * owning component
 * @param {Object} component - the component to delegate execution to
 * @param {String} rootType - the root type whose field resolver will be 
 * executed 
 * @param {String} fieldName - the root type field whose resolver is proxied
 * @returns {Function} - a function whose signature is a normal GraphQL 
 * resolver function but whose implementation delegates execution to the 
 * component owning the resolver's implementation
 */
const createProxyResolver = function (component, rootType, fieldName) {
  const proxyResolver = async function (_parent, args, contextValue, info) {
    debug(`delegating ${rootType}.${fieldName} to ${component.constructor.name}`);
    
    const result = await delegateToComponent(component, { contextValue, info });
    
    return result[info.path.key];
  };

  proxyResolver.__isProxy = true;

  return proxyResolver;
};

/**
 * replace the input component's root type field resolvers with a proxy
 * @param {Object} component - the component's whose root type field resolvers 
 * will be replaced with a proxy 
 * @param {Object} resolvers - the combined resolver map for the input component
 * @returns {Object} - the resolver map with root type field resolvers replaced
 * with a proxy function
 */
const createProxyResolvers = function (component, resolvers) {
  const proxyResolvers = {};

  const iterateRootTypeResolvers = function* () {
    for (const type of Object.keys(resolvers)) {
      if (['Query', 'Mutation', 'Subscription'].indexOf(type) > -1) {
        yield [type, resolvers[type]];
      }
    }
  };

  for (const [rootType, fieldResolvers] of iterateRootTypeResolvers()) {
    if (proxyResolvers[rootType] === undefined) {
      proxyResolvers[rootType] = {};
    }
    for (const [field, resolver] of Object.entries(fieldResolvers)) {
      if (resolver.__isProxy === true) {
        proxyResolvers[rootType][field] = resolver;
        continue;
      }
      proxyResolvers[rootType][field] = createProxyResolver(component, rootType, field);
    }
  }

  return proxyResolvers;
};

/**
 * combine a component's own resolvers with its imported resolvers
 * @param {Object} component - the component whose own resolvers and imported r
 * esolvers will be combined into 1 resolver map
 * @param {Boolean} proxyImportedResolvers - whether or not to replace the 
 * input component's root type field resolvers with a proxy
 * @returns {Object} - the combined resolver map
 */
const getImportedResolvers = function (component, proxyImportedResolvers) {
  const mergedResolvers = Object.assign({}, mergeResolvers([component._resolvers, component._importedResolvers]));

  return proxyImportedResolvers === true ? createProxyResolvers(component, mergedResolvers) : mergedResolvers;
};

module.exports = { memoize, transformResolvers, wrapResolvers, getImportedResolvers, createProxyResolvers, createProxyResolver, delegateToComponent };
