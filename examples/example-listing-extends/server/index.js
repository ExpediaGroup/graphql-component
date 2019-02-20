
const { ApolloServer, addMockFunctionsToSchema } = require('apollo-server');
const ListingComponent = require('../listing-component');

const { schema, context} = new ListingComponent();

addMockFunctionsToSchema({
  schema,
  preserveResolvers: false
});

const server = new ApolloServer({ schema, context });

server.listen().then(({ url }) => {
  console.log(`🚀 Server ready at ${url}`)
});