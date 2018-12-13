
const Util = require('util');
const debug = require('debug')('graphql:resolver');

const addDebug = function (name, resolverName, func) {
  return async function (...args) {
    debug(`executing fixture for ${name}.${resolverName}`);
    return await func(...args);
  }
};

const wrapFixtures = function (resolvers = {}, fixtures = {}) {
  const wrapped = {};

  for (const [name, value] of Object.entries(resolvers)) {
    if (Util.isObject(value)) {
      wrapped[name] = {};

      for (const [resolverName, func] of Object.entries(value)) {
        wrapped[name][resolverName] = addDebug(name, resolverName, process.env.GRAPHQL_DEBUG ? fixtures[name] && fixtures[name][resolverName] || func : func);
      }
    }
  }

  return wrapped;
};

module.exports = { wrapFixtures };