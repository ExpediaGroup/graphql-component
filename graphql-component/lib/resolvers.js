
const Util = require('util');
const Memoize = require('lodash.memoize');
const debug = require('debug')('graphql:resolver');

const debugFixture = function (fixtures, name, resolverName) {
  return async function (...args) {
    debug(`executing fixture for ${name}.${resolverName}`);
    return await fixtures[name][resolverName](...args);
  }
};

const wrapResolver = function (resolverName, resolver) {
  return function (_, argv, context, info) {
    const { parentType } = info;

    debug(`executing ${parentType}.${resolverName}`);
    if (!context.memoized) {
      context.memoized = {};
    }          
    if (context.memoized[parentType] && context.memoized[parentType][resolverName]) {
      debug(`intercepting with memoized ${parentType}.${resolverName}`);
      return context.memoized[parentType][resolverName](_, argv, context, info);
    }
    if (!context.memoized[parentType]) {
      context.memoized[parentType] = {};
    }

    const memoizedResolver = Memoize(resolver);

    context.memoized[parentType][resolverName] = memoizedResolver;

    return memoizedResolver(_, argv, context, info);
  };
};

const debugWrap = function (resolvers = {}, fixtures = {}) {
  const wrapped = {};

  for (const [name, value] of Object.entries(resolvers)) {
    if (Util.isObject(value)) {
      wrapped[name] = {};

      for (const [resolverName, func] of Object.entries(value)) {
        wrapped[name][resolverName] = process.env.GRAPHQL_DEBUG ? (fixtures[name] ? debugFixture(fixtures, name, resolverName) : func) : func;
      }
    }
  }

  return wrapped;
};

const createDelegates = function (resolvers, imports) {

  for (const imp of imports) {
    for (const parentType of ['Query', 'Mutation', 'Subscription']) {
      if (!imp.resolvers[parentType]) {
        continue;
      }

      for (const [name, value] of Object.entries(imp.resolvers[parentType])) {
        if (!resolvers[parentType]) {
          resolvers[parentType] = {};
        }
        resolvers[parentType][name] = function (...args) {
          debug(`delegating to import's ${parentType}.${name}`);
          return value(...args);
        };
      }
      resolvers[parentType]
    }
  }

  return resolvers;
};

module.exports = { wrapResolver, debugWrap, createDelegates };