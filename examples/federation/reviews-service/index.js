'use strict';

const { ApolloServer } = require('apollo-server');
const GraphQLComponent = require('../../../lib');
const ReviewsDataSource = require('./datasource');
const resolvers = require('./resolvers');
const types = require('./types');
const mocks = require('./mocks');

class ReviewsComponent extends GraphQLComponent {
  constructor({ dataSources = [new ReviewsDataSource()], ...options } = {}) {
    super({ types, resolvers, mocks, dataSources, ...options, federation: true });
  }
}

const startReviewsService = async () => {
  const { schema, context } = new ReviewsComponent();

  const server = new ApolloServer({
    schema,
    context,
    introspection: true,
    subscriptions: false,
    playground: false
  });

  const { url } = await server.listen({port: 4002});
  console.log(`🚀 reviews service ready at ${url}`);
}

module.exports = startReviewsService;


