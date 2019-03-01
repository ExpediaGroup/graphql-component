'use strict';

const Merge = require('./merge');
const debug = require('debug')('graphql-component:resolver');

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
        wrapped[name][resolverName] = memoize(resolverName, func.bind(bind));
        continue;
      }
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

const _cache = new WeakMap();

const memoize = function (fieldName, resolve) {
  return function (_, args, context, info) {
    const key = JSON.stringify(args);
    const { parentType } = info;

    debug(`executing ${parentType}.${fieldName}`);

    let cached = _cache.get(context);

    if (cached && cached[parentType] && cached[parentType][fieldName] && cached[parentType][fieldName][key]) {
      debug(`return cached result of memoized ${parentType}.${fieldName}`);
      return cached[parentType][fieldName][key];
    }

    if (!cached) {
      cached = {};
    }
    if (!cached[parentType]) {
      cached[parentType] = {};
    }
    if (!cached[parentType][fieldName]) {
      cached[parentType][fieldName] = {};
    }

    const result = resolve(_, args, context, info);

    cached[parentType][fieldName][key] = result;

    _cache.set(context, cached);

    debug(`cached ${parentType}.${fieldName}`);

    return result;
  };
};

module.exports = { wrapResolvers, getImportedResolvers, memoize };