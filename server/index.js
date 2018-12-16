
const { ApolloServer } = require('apollo-server');
const GraphQLComponent = require('../graphql-component');
const Author = require('../author-component');
const Book = require('./custom-book');

const { schema } = new GraphQLComponent({ imports: [ Author, Book ] });

const server = new ApolloServer({
    schema,
    context: async (request) => {
        return { request };
    } 
});

server.listen().then(({ url }) => {
    console.log(`🚀 Server ready at ${url}`)
});