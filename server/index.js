
const { ApolloServer } = require('apollo-server');
const { mergeComponentSchemas } = require('./lib/merge_components');

const { schema } = mergeComponentSchemas([require('../author-component'), require('./custom/book')]);

const server = new ApolloServer({
    schema,
    context: async (request) => {
        return { request };
    }
});

server.listen().then(({ url }) => {
    console.log(`🚀 Server ready at ${url}`)
});