
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
        const key = JSON.stringify(args);
        const { parentType } = info;
        
        let cached = _cache.get(context);

        if (cached && cached[parentType][field.name] && cached[parentType][field.name][key]) {
          debug(`return cached result of memoized ${parentType}.${field.name}`);
          return cached[parentType][field.name][key];
        }
    
        debug(`executing and caching memoized ${parentType}.${field.name}`);

        if (!cached) {
          cached = {};
        }
        if (!cached[parentType]) {
          cached[parentType] = {};
        }
        if (!cached[parentType][field.name]) {
          cached[parentType][field.name] = {};
        }
    
        const result = resolve(_, args, context, info);

        cached[parentType][field.name][key] = result;

        _cache.set(context, cached);
    
        return result;
      };
    };

    field.resolve = memoize(resolve);
  }
}

module.exports = { MemoizeDirective };