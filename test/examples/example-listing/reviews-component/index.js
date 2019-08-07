'use strict';

const GraphQLComponent = require('../../../../lib/index');
const ReviewsProvider = require('./provider');
const Resolvers = require('./resolvers');
const Types = require('./types');
const Mocks = require('./mocks');

class ReviewsComponent extends GraphQLComponent {
  constructor({ useMocks, preserveTypeResolvers, provider = new ReviewsProvider() } = {}) {
    super({ types: Types, resolvers: Resolvers, mocks: Mocks, useMocks, preserveTypeResolvers, provider });
  }
}

module.exports = ReviewsComponent;
