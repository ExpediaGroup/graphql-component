'use strict';

const debug = require('debug')('graphql-component:resolver');
const { GraphQLScalarType } = require('graphql');
const { mergeResolvers } = require('graphql-toolkit');
const { delegateToComponent } = require('./delegate');

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
    return delegateToComponent(component, { info, contextValue });
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
 * import resolvers from an input component
 * @param {Object} component - the component whose resolvers will be imported
 * @param {Array<string>} - An array of dot separated strings specifying Type.
 * field exclusions
 * @param {Boolean} proxyImportedResolvers - whether or not to replace the 
 * input component's root type field resolvers with a proxy
 * @returns {Object} - the combined resolver map
 */
const getImportedResolvers = function (component, exclude, proxyImportedResolvers) {
  // merge the component's own resolvers with its imported resolvers (with exclusions, if any) into one resolver map
  let mergedResolvers = Object.assign({}, mergeResolvers([component._resolvers, component._importedResolvers], { exclusions: exclude }));

  return proxyImportedResolvers === true ? createProxyResolvers(component, mergedResolvers) : mergedResolvers;
};

module.exports = { memoize, wrapResolvers, getImportedResolvers, createProxyResolver, delegateToComponent };
