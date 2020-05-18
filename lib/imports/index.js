'use strict';

const graphql = require('graphql');
const { createProxyResolvers, transformResolvers } = require('../resolvers');
const { namespaceDirectives, filterTypes } = require('../types');

const parseExcludes = function (exclude) {
  const excludes = [];

  if (exclude && exclude.length > 0) {
    excludes.push(...exclude.map((filter) => filter.split('.')));
  }

  return excludes;
}

const buildDependencyTree = function (root) {
  const mergedTypes = [];
  const mergedResolvers = [];

  const visited = new Set();
  const queue = [...root.imports]; 

  const rootDirectives = root.directives;

  while (queue.length > 0) {
    const current = queue.shift();

    const { component, exclude } = current;

    if (visited.has(component.id)) {
      continue;
    }

    const excludes = parseExcludes(exclude);

    const types = filterTypes(component.types.map((type) => {
      return namespaceDirectives(rootDirectives, `${component.name}_${component.id}`, graphql.parse(type))
    }), excludes);

    mergedTypes.push(...types);

    const resolvers = createProxyResolvers(component, transformResolvers(component.resolvers, excludes));

    mergedResolvers.push(resolvers);

    visited.add(component.id);
    queue.push(...component.imports);
  }

  return { mergedTypes, mergedResolvers };
};

module.exports = { buildDependencyTree };