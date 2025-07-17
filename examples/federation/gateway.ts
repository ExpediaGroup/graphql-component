import { ApolloServer } from 'apollo-server';
import { ApolloGateway } from '@apollo/gateway';

const run = async function(): Promise<void> {
  const gateway = new ApolloGateway({
    serviceList: [
      { name: 'property', url: 'http://localhost:4001' },
      { name: 'reviews', url: 'http://localhost:4002' }
    ]
  });

  const server = new ApolloServer({
    gateway
  });

  const { url } = await server.listen({port: 4000});
  console.log(`🚀 Gateway ready at ${url}`);
}

export { run }; 