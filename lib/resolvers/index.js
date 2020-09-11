'use strict';

const debug = require('debug')('graphql-component:resolver');
const { GraphQLScalarType } = require('graphql');

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

  return function (_, args, context, info) {
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

    const result = resolve(_, args, context, info);

    cached[key] = result;

    _cache.set(context, cached);

    debug(`cached ${parentType}.${fieldName}`);

    return result;
  };
};

/**
 * excludes types and/or fields on types from an input resolver map
 * @param {Object} resolvers - the input resolver map to filter
 * @param {Array<string>} excludes - an array of exclusions in the general form 
 * of "type.field". This format supports excluding all types ('*'), an entire 
 * type and the fields it encloses ('type', 'type.', 'type.*'), and individual 
 * fields on a type ('type.somefield').
 * @returns {Object} - a new resolver map with the applied exclusions
 */
const filterResolvers = function (resolvers, excludes) {
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
const bindResolvers = function (bind, resolvers = {}) {
  const bound = {};

  for (const [type, fieldResolvers] of Object.entries(resolvers)) {
    if (fieldResolvers instanceof GraphQLScalarType) {
      bound[type] = fieldResolvers;
      continue;
    }

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
        }
        else {
          result[type][field] = function (_, ...args) {
            if (_.__typename) {
              return field.startsWith('__') ? _.__typename : _[field];
            }
            return resolver(_, ...args);
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
 * returns a resolver map representing imported resolvers from the input 
 * component
 * @param {GraphQLComponent} component - the component to import resolvers from
 * @param {Array<Array<string>>} excludes - resolvers to exclude from the input 
 * component
 * @return {Object} - imported resolvers
 */
const importResolvers = function (component, excludes) {
  const filteredResolvers = filterResolvers(component.resolvers, excludes);
  return wrapNonRootTypeResolvers(filteredResolvers);
}

module.exports = { memoize, filterResolvers, bindResolvers, importResolvers};