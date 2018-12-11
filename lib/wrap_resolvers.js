
const { isObject } = require('util');

const wrapResolvers = function (resolvers, fixtures) {
  if (!process.env.GRAPHQL_DEBUG) {
    return resolvers;
  }

  const wrapped = {};

  for (const [name, value] of Object.entries(resolvers)) {
    if (isObject(value)) {
      wrapped[name] = {};
      for (const [resolverName, func] of Object.entries(value)) {
        const resolver = fixtures[name] ? fixtures[name][resolverName] : func;
        wrapped[name][resolverName] = async function (_, argv, context, info) {
          return await resolver(_, argv, context, info);
        };
      }
    }
  }

  return wrapped;
};

module.exports = { wrapResolvers };