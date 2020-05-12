'use strict';

const debug = require('debug')('graphql-component:resolver');
const { GraphQLScalarType, Kind } = require('graphql');

const memoize = function (parentType, fieldName, resolve) {
  const _cache = new WeakMap();

  return function (_, args, context, info) {
    const path = info && info.path && info.path.key;
    const key = `${path}_${JSON.stringify(args)}`;

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
  if (!excludes || excludes.length < 1) {
    return resolvers;
  }

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

      if (['Query', 'Mutation'].indexOf(name) > -1) {
        debug(`memoized ${name}.${resolverName}`);
        wrapped[name][resolverName] = memoize(name, resolverName, func.bind(bind));
      } else {
        // conditionally bind func since func will not be a function for
        // Subscriptions and internal enum remapping
        wrapped[name][resolverName] = typeof func === 'function' ? func.bind(bind) : func;
      }
    }
  }
  return wrapped;
};

const buildPathFromInfo = function (info) {
  const path = [];
  let current = info.path;

  do {
    path.unshift(current.key);
    current = current.prev;
  }
  while (current !== undefined);

  return path;
};

const createSubOperationForField = function (field, info) {
  const operation = info.operation;
  const fragments = info.fragments;

  const definitions = [];

  if (fragments) {
    for (const [, fragmentDefinition] of Object.entries(fragments)) {
      definitions.push(fragmentDefinition);
    }
  }

  const selectionSet = operation.selectionSet;

  //Reduce to selections that match the path, regardless of alias
  selectionSet.selections = info.fieldNodes.filter((fieldNode) => fieldNode.name.value === field && (info.path.key === fieldNode.name.value || info.path.key === fieldNode.alias.value));

  definitions.push({
    kind: Kind.OPERATION_DEFINITION,
    operation: operation.operation,
    variableDefinitions: operation.variableDefinitions,
    selectionSet
  });

  return {
    kind: Kind.DOCUMENT,
    definitions
  };
};

const createProxyResolver = function (component, root, field) {
  const proxyResolver = async function (_, args, context, info) {
    const { variableValues } = info;

    debug(`delegating ${root}.${field} to imported component schema.`);

    const result = await component.execute(createSubOperationForField(field, info), { context, variableValues, mergeErrors: true });

    return result[info.path.key];
  };

  proxyResolver.__isProxy = true;

  return proxyResolver;
};

const createProxyResolvers = function (component, resolvers) {
  const proxyResolvers = {};

  const iterateRootTypeResolvers = function* () {
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

module.exports = { memoize, transformResolvers, wrapResolvers, createProxyResolvers, createProxyResolver };
