
const { ApolloServer } = require('apollo-server');
const { ApolloGateway } = require('@apollo/gateway');

const gateway = new ApolloGateway({
  serviceList: [
    { name: 'property', url: 'http://property:4000' },
    { name: 'reviews', url: 'http://reviews:4000' }
  ]
});

const server = new ApolloServer({ 
  gateway,
  subscriptions: false
});

server.listen().then(({ url }) => {
  console.log(`🚀 Server ready at ${url}`)
});