
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

        if (cached && cached[parentType][field.name]) {
          debug(`return cached result of memoized ${parentType}.${field.name}`);
          return cached[parentType][field.name];
        }
    
        debug(`executing and caching memoized ${parentType}.${field.name}`);
    
        const result = resolve(_, args, context, info);
    
        if (cached) {
          if (!cached[parentType]) {
            cached[parentType] = {};
          }
          cached[parentType][field.name] = result;

          _cache.set(context, cached);
        }
        else {
          _cache.set(context, { [parentType] : { [field.name] : result }});
        }
    
        return result;
      };
    };

    field.resolve = memoize(resolve);
  }
}

module.exports = { MemoizeDirective };