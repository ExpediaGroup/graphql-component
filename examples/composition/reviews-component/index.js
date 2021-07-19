'use strict';

const GraphQLComponent = require('../../../lib/index');
const ReviewsDataSource = require('./datasource');
const resolvers = require('./resolvers');
const types = require('./types');

class ReviewsComponent extends GraphQLComponent {
  constructor({ dataSources = [new ReviewsDataSource()], ...options } = {}) {
    super({ types, resolvers, dataSources, ...options });
  }
}

module.exports = ReviewsComponent;
