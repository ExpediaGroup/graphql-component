'use strict';

const debug = require('debug')('graphql-component:resolver');
const { GraphQLScalarType } = require('graphql');

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

  return boundResolvers;
}

module.exports = { bindResolvers };