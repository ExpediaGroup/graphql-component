'use strict';

const GraphQLComponent = require('../../../../lib/index');
const ReviewsDataSource = require('./datasource');
const resolvers = require('./resolvers');
const types = require('./types');
const mocks = require('./mocks');

class ReviewsComponent extends GraphQLComponent {
  constructor({ dataSource = new ReviewsDataSource(), ...options } = {}) {
    super({ types, resolvers, mocks, dataSource, ...options });
  }
}

module.exports = ReviewsComponent;
