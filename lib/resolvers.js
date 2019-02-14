
const Merge = require('./merge');
const debug = require('debug')('graphql-component:resolver');

const wrapFixture = function (name, resolverName, func, bind) {
  return function (...args) {
    debug(`executing fixture for ${name}.${resolverName}`);
    return func.call(bind, ...args);
  }
};

const wrap = function (name, resolverName, func, bind) {
  return function (...args) {
    debug(`executing ${name}.${resolverName}`);
    return func.call(bind, ...args);
  }
};

const wrapResolvers = function (resolvers = {}, fixtures = {}, bind, useFixtures) {
  const wrapped = {};

  if (useFixtures) {
    for (const [name, value] of Object.entries(fixtures)) {
      if (!wrapped[name]) {
        wrapped[name] = {};
      }
      for (const [resolverName, fixture] of Object.entries(value)) {
        wrapped[name][resolverName] = wrapFixture(name, resolverName, fixture, bind);
      }
    }
  }

  for (const [name, value] of Object.entries(resolvers)) {
    if (!wrapped[name]) {
      wrapped[name] = {};
    }

    for (const [resolverName, func] of Object.entries(value)) {
      if (wrapped[name][resolverName]) {
        continue;
      }

      wrapped[name][resolverName] = wrap(name, resolverName, func, bind);
    }
  }

  return wrapped;
};

const getImportedResolvers = function (imp) {
  const importedResolvers = {};

  const allResolvers = Merge.mergeResolvers(imp._resolvers, imp._importedResolvers);

  for (const [parentType, resolvers] of Object.entries(allResolvers)) {
    if (!importedResolvers[parentType]) {
      importedResolvers[parentType] = {};
    }

    for (const [name, value] of Object.entries(resolvers)) {
      importedResolvers[parentType][name] = value.bind(imp);
    }
  }

  return importedResolvers;
};

module.exports = { wrapResolvers, getImportedResolvers };