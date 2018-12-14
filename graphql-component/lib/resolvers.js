
const Util = require('util');
const debug = require('debug')('graphql:resolver');

const wrapFixture = function (name, resolverName, func) {
  return function (...args) {
    debug(`executing fixture for ${name}.${resolverName}`);
    return func(...args);
  }
};

const wrap = function (name, resolverName, func) {
  return function (...args) {
    debug(`executing ${name}.${resolverName}`);
    return func(...args);
  }
};

const wrapResolvers = function (resolvers = {}, fixtures = {}) {
  const wrapped = {};

  for (const [name, value] of Object.entries(resolvers)) {
    if (Util.isObject(value)) {
      wrapped[name] = {};

      for (const [resolverName, func] of Object.entries(value)) {
        const debugWrap = !!(process.env.GRAPHQL_DEBUG && fixtures[name] && fixtures[name][resolverName]);

        wrapped[name][resolverName] = debugWrap ? wrapFixture(name, resolverName, fixtures[name][resolverName]) : wrap(name, resolverName, func);
      }
    }
  }

  return wrapped;
};

module.exports = { wrapResolvers };