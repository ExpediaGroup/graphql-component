
const { ApolloServer } = require('apollo-server');
const ListingComponent = require('../listing-component');

const { schema, context} = new ListingComponent({ useFixtures: !!process.env.GRAPHQL_DEBUG });

const server = new ApolloServer({ schema, context });

server.listen().then(({ url }) => {
    console.log(`🚀 Server ready at ${url}`)
});