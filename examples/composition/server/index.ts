
const { ApolloServer } = require('apollo-server');
const ListingComponent = require('../listing-component');

const { schema, context } = new ListingComponent();

const server = new ApolloServer({ schema, context, tracing: false });

server.listen().then(({ url }) => {
  console.log(`🚀 Server ready at ${url}`)
});
