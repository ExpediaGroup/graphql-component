
const { ApolloServer } = require('apollo-server');
const { mergeComponentSchemas } = require('./lib/merge_components');

const { schema } = mergeComponentSchemas([require('./components/author'), require('./components/book_sub')]);

const server = new ApolloServer({
    schema,
    context: async (request) => {
        return { request };
    }
});

server.listen().then(({ url }) => {
    console.log(`🚀 Server ready at ${url}`)
});