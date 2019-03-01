'use strict';

const { SchemaDirectiveVisitor } = require('graphql-tools');
const Resolver = require('./resolvers');
const debug = require('debug')('graphql-component:directive');

const _cache = new WeakMap();

class MemoizeDirective extends SchemaDirectiveVisitor {
  visitFieldDefinition(field) {
    const { resolve } = field;
    console.log(field);
    if (!resolve) {
      return;
    }

    field.resolve = Resolver.memoize(field.name, resolve);

    debug(`memoized ${field.name}`);
  }
}

module.exports = { MemoizeDirective };