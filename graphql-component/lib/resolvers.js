

const Merge = require('./merge');
const debug = require('debug')('graphql-components:resolver');

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

const wrapResolvers = function (resolvers = {}, fixtures = {}, bind) {
  const wrapped = {};

  for (const [name, value] of Object.entries(resolvers)) {
    if (!wrapped[name]) {
      wrapped[name] = {};
    }

    for (const [resolverName, func] of Object.entries(value)) {
      const debugWrap = !!(process.env.GRAPHQL_DEBUG && fixtures[name] && fixtures[name][resolverName]);

      wrapped[name][resolverName] = debugWrap ? wrapFixture(name, resolverName, fixtures[name][resolverName].bind(bind)) : wrap(name, resolverName, func.bind(bind));
    }
  }

  return wrapped;
};

const getImportedResolvers = function (imports) {
  const importedResolvers = {};

  for (const imp of imports) {
    const allResolvers = Merge.mergeResolvers(imp._resolvers, imp._imported.resolvers);

    for (const [parentType, resolvers] of Object.entries(allResolvers)) {
      if (!importedResolvers[parentType]) {
        importedResolvers[parentType] = {};
      }

      for (const [name, value] of Object.entries(resolvers)) {
        importedResolvers[parentType][name] = value.bind(imp);
      }
    }
  }

  return importedResolvers;
};

module.exports = { wrapResolvers, getImportedResolvers };