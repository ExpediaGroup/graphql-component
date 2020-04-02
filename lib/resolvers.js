'use strict';

const debug = require('debug')('graphql-component:resolver');
const { mergeResolvers } = require('graphql-toolkit');
const { GraphQLScalarType } = require('graphql');
const { delegateToSchema } = require('graphql-tools');

const memoize = function (parentType, fieldName, resolve) {
  const _cache = new WeakMap();

  return function (_, args, context, info) {
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
  let filteredResolvers = Object.assign({}, resolvers);

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
    if (value instanceof GraphQLScalarType) {
      wrapped[name] = value;
      continue;
    }
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
      // bind if the value mapped to a resolverName is a function
      // otherwise dont to support internal enum value remapping
      wrapped[name][resolverName] = typeof func === 'function' ? func.bind(bind) : func;
    }

  }

  return wrapped;
};

const createProxyResolver = function (component, root, field) {
  const proxyResolver = function (_, args, context, info) {
    debug(`delegating ${root}.${field} to imported component schema.`);

    return delegateToSchema({
      schema: component.schema,
      operation: root.toLowerCase(),
      fieldName: field,
      args,
      context,
      info
    });
  };

  proxyResolver.__isProxy = true;

  return proxyResolver;
};

const createProxyResolvers = function (component, resolvers) {
  const proxyResolvers = {};

  const iterateRootTypeResolvers = function *() {
    for (const name of Object.keys(resolvers)) {
      if (['Query', 'Mutation', 'Subscription'].indexOf(name) > -1) {
        yield [name, resolvers[name]];
      }
    }
  };

  for (const [root, fieldResolvers] of iterateRootTypeResolvers()) {
    if (proxyResolvers[root] === undefined) {
      proxyResolvers[root] = {};
    }
    for (const [field, resolver] of Object.entries(fieldResolvers)) {
      if (resolver.__isProxy === true) {
        proxyResolvers[root][field] = resolver;
        continue;
      }
      proxyResolvers[root][field] = createProxyResolver(component, root, field);
    }
  }

  return proxyResolvers;
};

const getImportedResolvers = function (component, proxyImportedResolvers) {
  const resolvers = proxyImportedResolvers === true ? createProxyResolvers(component, component._resolvers) : component._resolvers;

  return Object.assign({}, mergeResolvers([resolvers, component._importedResolvers]));
};

module.exports = { memoize, transformResolvers, wrapResolvers, getImportedResolvers, createProxyResolvers, createProxyResolver };
