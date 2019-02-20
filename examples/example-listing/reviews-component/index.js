
const GraphQLComponent = require('../../../lib/index');
const Resolvers = require('./resolvers');
const Types = require('./types');
const Mocks = require('./mocks');

class ReviewsComponent extends GraphQLComponent {
  constructor({ useMocks, preserveTypeResolvers }) {
    super({ types: Types, resolvers: Resolvers, mocks: Mocks, useMocks, preserveTypeResolvers });
  }
}

module.exports = ReviewsComponent;