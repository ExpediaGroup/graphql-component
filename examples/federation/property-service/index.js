'use strict';

const { ApolloServer } = require('apollo-server');
const GraphQLComponent = require('../../../dist').default;
const PropertyDataSource = require('./datasource');
const resolvers = require('./resolvers');
const types = require('./types');

class PropertyComponent extends GraphQLComponent {
  constructor(options) {
    super(options);
  }
}

const run = async function () {
  const { schema, context } = new PropertyComponent({
    types,
    resolvers,
    dataSources: [new PropertyDataSource()],
    federation: true
  });

  const server = new ApolloServer({
    schema,
    context,
    subscriptions: false,
  });

  const { url } = await server.listen({port: 4001})
  console.log(`🚀 Property service ready at ${url}`)
}

module.exports = { run };