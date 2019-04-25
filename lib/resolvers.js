'use strict';

const debug = require('debug')('graphql-component:resolver');
const { mergeResolvers } = require('graphql-toolkit');

const memoize = function (parentType, fieldName, resolve) {
  const _cache = new WeakMap();

  return function (_, args, context, info ) {
    const key = JSON.stringify(args);

    debug(`executing ${parentType}.${fieldName}`);

    let cached = _cache.get(context);

    if (cached && cached[key]) {
      debug(`return cached result of memoized ${parentType}.${fieldName}`);
      return cached[key];
    }

    if (!cached) {
      cached = {};
    }

    const result = resolve(_, args, context, info);

    cached[key] = result;

    _cache.set(context, cached);

    debug(`cached ${parentType}.${fieldName}`);

    return result;
  };
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
      if (['Query', 'Mutation', 'Subscription'].indexOf(name) > -1) {
        debug(`memoized ${name}.${resolverName}`);
        wrapped[name][resolverName] = memoize(name, resolverName, func.bind(bind));
        continue;
      }
      wrapped[name][resolverName] = func.bind(bind);
    }
  }

  return wrapped;
};

const getImportedResolvers = function (component) {
  const importedResolvers = {};

  const allResolvers = mergeResolvers([component.resolvers, component.importedResolvers]);

  for (const [parentType, resolvers] of Object.entries(allResolvers)) {
    if (!importedResolvers[parentType]) {
      importedResolvers[parentType] = {};
    }

    for (const [name, value] of Object.entries(resolvers)) {
      importedResolvers[parentType][name] = value;
    }
  }

  return importedResolvers;
};

module.exports = { memoize, transformResolvers, wrapResolvers, getImportedResolvers };
