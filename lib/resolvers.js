'use strict';

const debug = require('debug')('graphql-component:resolver');
const { GraphQLScalarType } = require('graphql');
const { mergeResolvers } = require('graphql-toolkit');

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
const bindResolvers = function (bind, resolvers = {}) {
  const bound = {};

  for (const [type, fieldResolvers] of Object.entries(resolvers)) {
    if (fieldResolvers instanceof GraphQLScalarType) {
      bound[type] = fieldResolvers;
      continue;
    }

    // if the current type's resolver functions haven't been bound yet
    // create a fresh map to do so
    if (!bound[type]) {
      bound[type] = {};
    }

    for (const [field, resolverFunc] of Object.entries(fieldResolvers)) {
      if (bound[type][field]) {
        continue;
      }

      if (['Query', 'Mutation'].indexOf(type) > -1) {
        debug(`memoized ${type}.${field}`);
        bound[type][field] = memoize(type, field, resolverFunc.bind(bind));
      } else {
        // for types other than Query/Mutation - conditionally bind since in
        // some cases (Subscriptions and enum remaps) resolverFunc will be 
        // an object instead of a function
        bound[type][field] = typeof resolverFunc === 'function' ? resolverFunc.bind(bind) : resolverFunc;
      }
    }
  }
  return bound;
};

/**
 * wraps non root type resolvers from the input resolver map that quick returns 
 * if __typename is detected
 * @param {object} resolvers - the input resolver map with which non root 
 * resolvers will be wrapped
 * @returns {object} the resulting resolver map with non root type resolvers 
 * wrapped
 */
const wrapNonRootTypeResolvers = function (resolvers) {
  const result = {};

  for (const [type, fieldResolvers] of Object.entries(resolvers)) {
    if (['Query', 'Mutation', 'Subscription'].indexOf(type) === -1) {
      if (!result[type]) {
        result[type] = {};
      }
      for (const [field, resolver] of Object.entries(fieldResolvers)) {
        // handle non-root types that are enum remaps
        if (typeof resolver !== 'function') {
          result[type][field] = resolver;
          continue;
        }
        if (field.startsWith('__')) {
          result[type][field] = function (result, context, info, returnType) {
            if (result.__typename) {
              return result.__typename;
            }
            return resolver(result, context, info, returnType);
          }
        }
        else {
          result[type][field] = function (result, args, context, info) {
            if (result.__typename) {
              return result[info.fieldName];
            }
            return resolver(result, args, context, info);
          }
        }
      }
    }
    else {
      result[type] = fieldResolvers;
    }
  }

  return result;
}

/**
 * import resolvers from an input component
 * @param {Object} component - the component whose resolvers will be imported
 * @param {Array<string>} - An array of dot separated strings specifying Type.
 * field exclusions
 * @param {Boolean} proxyImportedResolvers - whether or not to replace the 
 * input component's root type field resolvers with a proxy
 * @returns {Object} - the combined resolver map
 */
const getImportedResolvers = function (component, exclude) {
  // merge the component's own resolvers with its imported resolvers (with exclusions, if any) into one resolver map
  let mergedResolvers = Object.assign({}, mergeResolvers([component._resolvers, component._importedResolvers], { exclusions: exclude }));

  return wrapNonRootTypeResolvers(mergedResolvers);
};

module.exports = { memoize, bindResolvers, getImportedResolvers };
