
const Util = require('util');
const debug = require('debug')('graphql:resolver');

const addDebug = function (fixtures, name, resolverName) {
  return async function (...args) {
    debug(`executing fixture for ${name}.${resolverName}`);
    return await fixtures[name][resolverName](...args);
  }
};

const wrapFixtures = function (resolvers = {}, fixtures = {}) {
  const wrapped = {};

  for (const [name, value] of Object.entries(resolvers)) {
    if (Util.isObject(value)) {
      wrapped[name] = {};

      for (const [resolverName, func] of Object.entries(value)) {
        wrapped[name][resolverName] = process.env.GRAPHQL_DEBUG ? (fixtures[name] ? addDebug(fixtures, name, resolverName) : func) : func;
      }
    }
  }

  return wrapped;
};

module.exports = { wrapFixtures };