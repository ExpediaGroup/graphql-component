
const debug = require('debug')('graphql:resolver');

const createDelegates = function (imports) {
  const delegates = {};

  for (const imp of imports) {
    for (const parentType of ['Query', 'Mutation', 'Subscription']) {
      if (!imp.resolvers[parentType]) {
        continue;
      }

      for (const [name, value] of Object.entries(imp.resolvers[parentType])) {
        if (!delegates[parentType]) {
          delegates[parentType] = {};
        }
        delegates[parentType][name] = function (...args) {
          debug(`delegating to import's ${parentType}.${name}`);
          return value(...args);
        };
      }
    }
  }

  return delegates;
};

module.exports = { createDelegates };