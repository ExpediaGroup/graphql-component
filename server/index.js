
const { ApolloServer } = require('apollo-server');
const GraphQLComponent = require('../graphql-component');

const schema = new GraphQLComponent({
  imports: [
    require('../author-component'),
    require('./custom/book'),
    require('./custom/book-sub')
  ]
}).schema;

const server = new ApolloServer({
    schema,
    context: async (request) => {
        return { request };
    } 
});

server.listen().then(({ url }) => {
    console.log(`🚀 Server ready at ${url}`)
});