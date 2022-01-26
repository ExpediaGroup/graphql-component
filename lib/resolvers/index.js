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
 * make 'this' in resolver functions equal to the input bindContext
 * @param {Object} bind - the object context to bind to resolver functions
 * @param {Object} resolvers - the resolver map containing the resolver
 * functions to bind
 * @returns {Object} - an object identical in structure to the input resolver
 * map, except with resolver function bound to the input argument bind
 */
const bindResolvers = function (bindContext, resolvers = {}) {
  const boundResolvers = {};

  for (const [type, fields] of Object.entries(resolvers)) {
    // dont bind an object that is an instance of a graphql scalar
    if (fields instanceof GraphQLScalarType) {
      debug(`not binding ${type}'s fields since ${type}'s fields are an instance of GraphQLScalarType`)
      boundResolvers[type] = fields;
      continue;
    }

    if (!boundResolvers[type]) {
      boundResolvers[type] = {};
    }

    for (const [field, resolver] of Object.entries(fields)) {
      if (['Query', 'Mutation'].indexOf(type) > -1) {
        debug(`memoized ${type}.${field}`);
        boundResolvers[type][field] = memoize(type, field, resolver.bind(bindContext));
      }
      else {
        // only bind resolvers that are functions
        if (typeof resolver === 'function') {
          debug(`binding ${type}.${field}`);
          boundResolvers[type][field] = resolver.bind(bindContext);
        }
        else {
          debug(`not binding ${type}.${field} since ${field} is not mapped to a function`);
          boundResolvers[type][field] = resolver;
        }
      }
    }
  }

  return boundResolvers;
}

module.exports = { bindResolvers, memoize };

