
const { ApolloServer } = require('apollo-server');
const { mergePartialsSchemas } = require('./lib/merge_partials');

const { schema } = mergePartialsSchemas([require('./partials/author'), require('./partials/book_sub')]);

const server = new ApolloServer({
    schema,
    context: async (request) => {
        return { request };
    }
});

server.listen().then(({ url }) => {
    console.log(`🚀 Server ready at ${url}`)
});