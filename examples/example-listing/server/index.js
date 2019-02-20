
const { ApolloServer } = require('apollo-server');
const TraceExtension = require('./trace');
const ListingComponent = require('../listing-component');

const { schema, context} = new ListingComponent({ useMocks: !!process.env.GRAPHQL_DEBUG, preserveTypeResolvers: true });

const server = new ApolloServer({ schema, context, extensions: [() => new TraceExtension()] });

server.listen().then(({ url }) => {
    console.log(`🚀 Server ready at ${url}`)
});
