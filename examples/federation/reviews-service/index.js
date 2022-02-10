'use strict';

const { ApolloServer } = require('apollo-server');
const GraphQLComponent = require('../../../lib');
const ReviewsDataSource = require('./datasource');
const resolvers = require('./resolvers');
const types = require('./types');

class ReviewsComponent extends GraphQLComponent {
  constructor(options) {
    super(options);
  }
}

const run = async function () {
  const { schema, context } = new ReviewsComponent({
    types,
    resolvers,
    dataSources: [new ReviewsDataSource()],
    federation: true
  });

  const server = new ApolloServer({
    schema,
    context,
    subscriptions: false
  });

  const { url } = await server.listen({port: 4002})
  console.log(`🚀 Reviews service ready at ${url}`)

}

module.exports = { run };