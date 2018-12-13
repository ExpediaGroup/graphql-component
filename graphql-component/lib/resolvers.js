
const Util = require('util');
const Memoize = require('lodash.memoize');
const debug = require('debug')('graphql:resolver');

const debugFixture = function (fixtures, name, resolverName) {
  return async function (...args) {
    debug(`executing fixture for ${name}.${resolverName}`);
    return await fixtures[name][resolverName](...args);
  }
};

const wrapResolvers = function (resolvers = {}, fixtures = {}) {
  const wrapped = {};

  for (const [name, value] of Object.entries(resolvers)) {
    if (Util.isObject(value)) {
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

          const memoizedResolver = Memoize(resolver);

          context.memoized[name][resolverName] = memoizedResolver;

          return await memoizedResolver(_, argv, context, info);
        };
      }
    }
  }

  return wrapped;
};

const createDelegates = function (resolvers, imports) {

  for (const imp of imports) {
    for (const root of ['Query', 'Mutation', 'Subscription']) {
      if (!imp.resolvers[root]) {
        continue;
      }

      for (const [name, value] of Object.entries(imp.resolvers[root])) {
        if (!resolvers[root]) {
          resolvers[root] = {};
        }
        resolvers[root][name] = function (...args) {
          debug(`delegating to import's ${root}.${name}`);
          return value(...args);
        };
      }
      resolvers[root]
    }
  }

  return resolvers;
};

module.exports = { wrapResolvers, createDelegates };