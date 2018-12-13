
const { SchemaDirectiveVisitor } = require('graphql-tools');
const Memoize = require('lodash.memoize');
const debug = require('debug')('graphql:resolver');

class MemoizeDirective extends SchemaDirectiveVisitor {
  visitFieldDefinition(field) {
    const { resolve } = field;

    if (!resolve) {
      return;
    }

    field.resolve =  function (_, argv, context, info) {
      const { parentType } = info;
  
      debug(`executing ${parentType}.${field.name}`);
      if (!context.memoized) {
        context.memoized = {};
      }          
      if (context.memoized[parentType] && context.memoized[parentType][field.name]) {
        debug(`intercepting with memoized ${parentType}.${field.name}`);
        return context.memoized[parentType][field.name](_, argv, context, info);
      }
      if (!context.memoized[parentType]) {
        context.memoized[parentType] = {};
      }
  
      const memoizedResolver = Memoize(resolve);
  
      context.memoized[parentType][field.name] = memoizedResolver;
  
      return memoizedResolver(_, argv, context, info);
    };
  }
}

module.exports = { MemoizeDirective };