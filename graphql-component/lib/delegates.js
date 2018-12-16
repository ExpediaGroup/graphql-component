
const debug = require('debug')('graphql:resolver');

const Merge = require('./merge');

const createDelegates = function (imports) {
  const delegates = {};

  for (const imp of imports) {
    const importName = imp.name || 'import'  ;
    const allResolvers = Merge.mergeResolvers(imp.resolvers, imp.delegates);

    for (const [parentType, resolvers] of Object.entries(allResolvers)) {
      if (!delegates[parentType]) {
        delegates[parentType] = {};
      }

      for (const [name, value] of Object.entries(resolvers)) {
        delegates[parentType][name] = function (...args) {
          debug(`delegating to ${importName}'s ${parentType}.${name}`);
          return value(...args);
        };
      }
    }
  }

  return delegates;
};

module.exports = { createDelegates };