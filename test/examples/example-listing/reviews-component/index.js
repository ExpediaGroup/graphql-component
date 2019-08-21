'use strict';

const GraphQLComponent = require('../../../../lib/index');
const ReviewsProvider = require('./provider');
const resolvers = require('./resolvers');
const types = require('./types');
const mocks = require('./mocks');

class ReviewsComponent extends GraphQLComponent {
  constructor({ provider = new ReviewsProvider(), ...options } = {}) {
    super({ types, resolvers, mocks, provider, ...options });
  }
}

module.exports = ReviewsComponent;
