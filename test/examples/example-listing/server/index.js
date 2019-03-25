
const { ApolloServer } = require('apollo-server');
const TraceExtension = require('./trace');
const ListingComponent = require('../listing-component');

const { schema, context} = new ListingComponent({ useMocks: !!process.env.MOCK, preserveTypeResolvers: true });

const server = new ApolloServer({ schema, context,  tracing: true, extensions: [() => new TraceExtension()] });

server.listen().then(({ url }) => {
    console.log(`🚀 Server ready at ${url}`)
});
