'use strict';

const { SchemaDirectiveVisitor } = require('graphql-tools');
const debug = require('debug')('graphql-component:directive');

const memoize = function (fieldName, resolve) {
  const _cache = new WeakMap();
  
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

class MemoizeDirective extends SchemaDirectiveVisitor {
  visitFieldDefinition(field) {
    const { resolve } = field;

    if (!resolve) {
      return;
    }

    field.resolve = memoize(field.name, resolve);

    debug(`memoized ${field.name}`);
  }
}

module.exports = { MemoizeDirective, memoize };