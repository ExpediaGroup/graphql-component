
const { SchemaDirectiveVisitor } = require('graphql-tools');
const Resolvers = require('./resolvers');

class MemoizeDirective extends SchemaDirectiveVisitor {
  visitFieldDefinition(field) {
    const { resolve } = field;

    if (!resolve) {
      return;
    }

    field.resolve = Resolvers.wrapResolver(field.name, field.resolve);
  }
}

module.exports = { MemoizeDirective };