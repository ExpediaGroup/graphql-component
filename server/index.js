
const { ApolloServer } = require('apollo-server');
const GraphQLComponent = require('../graphql-component');

const server = new ApolloServer({
    schema: GraphQLComponent.mergeAll([require('../author-component'), require('./custom/book')]),
    context: async (request) => {
        return { request };
    } 
});

server.listen().then(({ url }) => {
    console.log(`🚀 Server ready at ${url}`)
});