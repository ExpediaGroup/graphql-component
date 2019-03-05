'use strict';

const Merge = require('./merge');
//const { memoize } = require('./memoize');
//const debug = require('debug')('graphql-component:resolver');

const wrapResolvers = function (bind, resolvers = {}) {
  const wrapped = {};

  for (const [name, value] of Object.entries(resolvers)) {
    if (!wrapped[name]) {
      wrapped[name] = {};
    }

    for (const [resolverName, func] of Object.entries(value)) {
      if (wrapped[name][resolverName]) {
        continue;
      }
      // if (['Query', 'Mutation', 'Subscription'].indexOf(name) > -1) {
      //   debug(`memoized ${name}.${resolverName}`);
      //   wrapped[name][resolverName] = memoize(resolverName, func.bind(bind));
      //   continue;
      // }
      wrapped[name][resolverName] = func.bind(bind);
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