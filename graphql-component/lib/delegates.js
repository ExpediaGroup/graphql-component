
const debug = require('debug')('graphql:resolver');

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

module.exports = { createDelegates };