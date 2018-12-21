
const { ApolloServer } = require('apollo-server');
const ListingComponent = require('../listing-component');

const { schema, context} = ListingComponent;

const server = new ApolloServer({ schema, context });

server.listen().then(({ url }) => {
    console.log(`🚀 Server ready at ${url}`)
});