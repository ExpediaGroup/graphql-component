
const { ApolloServer } = require('apollo-server');
const ListingComponent = require('../listing-component');

const { schema, context} = new ListingComponent({ 
  useMocks: !!process.env.MOCK, 
  preserveTypeResolvers: true,
  providerOverrides: [
    new class MockPropertyProvider {
      get name() {
        return 'PropertyProvider';
      }
      getPropertyById(context, id) {
        return {
          id: 'override id',
          geo: ['lat', 'long']
        };
      }
    }
  ]
});

const server = new ApolloServer({ schema, context });

server.listen().then(({ url }) => {
  console.log(`🚀 Server ready at ${url}`)
});
