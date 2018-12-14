
const { SchemaDirectiveVisitor } = require('graphql-tools');
const debug = require('debug')('graphql:resolver');

const _cache = new WeakMap();

class MemoizeDirective extends SchemaDirectiveVisitor {
  visitFieldDefinition(field) {
    const { resolve } = field;

    if (!resolve) {
      return;
    }

    const memoize = function (resolve) {
      return function (_, args, context, info) {
        const { parentType } = info;
        const cached = _cache.get(context);
    
        if (cached) {
          debug(`return cached result of memoized ${parentType}.${field.name}`);
          return cached;
        }
    
        debug(`executing and caching memoized ${parentType}.${field.name}`);
    
        const result = resolve(_, args, context, info);
    
        _cache.set(context, result);
    
        return result;
      };
    };

    field.resolve = memoize(resolve);
  }
}

module.exports = { MemoizeDirective };