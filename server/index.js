
const { ApolloServer } = require('apollo-server');
const Listing = require('../listing-component');

const server = new ApolloServer({
    schema: Listing.schema,
    context: async (request) => {
        return { request };
    } 
});

server.listen().then(({ url }) => {
    console.log(`🚀 Server ready at ${url}`)
});