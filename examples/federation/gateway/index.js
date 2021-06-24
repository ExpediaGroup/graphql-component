
const { ApolloServer } = require('apollo-server');
const { ApolloGateway } = require('@apollo/gateway');

const startGateway = async () => {
  const gateway = new ApolloGateway({
    serviceList: [
      { name: 'property', url: 'http://localhost:4001' },
      { name: 'reviews', url: 'http://localhost:4002' }
    ]
  });

  const server = new ApolloServer({
    gateway,
    subscriptions: false
  });

  const { url } = await server.listen({port: 4000});
  console.log(`🚀 Gateway ready at ${url}`);
}

module.exports = startGateway;

