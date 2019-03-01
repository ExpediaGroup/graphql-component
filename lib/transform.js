'use strict';

const GraphQLTools = require('graphql-tools');

const transformExclude = function (excludes) {
  return new GraphQLTools.FilterRootFields((operation, fieldName) => {
    for (const [root, name] in excludes) {
      if (root === '*') {
        return true;
      }
      return operation === root && (name === '' || name === '*' || name === fieldName);
    }
  });
};

const transformResolvers = function (resolvers, excludes) {
  const filteredResolvers = Object.assign({}, resolvers);

  for (const [root, name] of excludes) {
    if (root === '*') {
      filteredResolvers = {};
      break;
    }
    if (!name || name === '' || name === '*') {
      delete filteredResolvers[root];
      continue;
    }
    delete filteredResolvers[root][name];
  }

  return filteredResolvers;
};

module.exports = { transformExclude, transformResolvers };