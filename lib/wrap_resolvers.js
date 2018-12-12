
const { isObject } = require('util');
const memoize = require('lodash.memoize');
const debug = require('debug')('graphql:resolver');

const debugFixture = function (fixtures, name, resolverName) {
  return async function (...args) {
    debug(`executing fixture for ${name}.${resolverName}`);
    return await fixtures[name][resolverName](...args);
  }
};

const wrapResolvers = function (resolvers = {}, fixtures = {}) {
  if (!process.env.GRAPHQL_DEBUG) {
    return resolvers;
  }

  const wrapped = {};

  for (const [name, value] of Object.entries(resolvers)) {
    if (isObject(value)) {
      wrapped[name] = {};

      for (const [resolverName, func] of Object.entries(value)) {
        const resolver = process.env.GRAPHQL_DEBUG ? (fixtures[name] ? debugFixture(fixtures, name, resolverName) : func) : func;
        
        wrapped[name][resolverName] = async function (_, argv, context, info) {
          debug(`executing ${name}.${resolverName}`);
          if (!context.memoized) {
            context.memoized = {};
          }          
          if (context.memoized[name] && context.memoized[name][resolverName]) {
            debug(`intercepting with memoized ${name}.${resolverName}`);
            return await context.memoized[name][resolverName](_, argv, context, info);
          }
          if (!context.memoized[name]) {
            context.memoized[name] = {};
          }

          const memoizedResolver = memoize(resolver);

          context.memoized[name][resolverName] = memoizedResolver;

          return await memoizedResolver(_, argv, context, info);
        };
      }
    }
  }

  return wrapped;
};

module.exports = { wrapResolvers };