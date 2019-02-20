
const resolvers = {
  Query: {
    property(_, { id }) {
      return {
        id: 1,
        geo: ['41.40338', '2.17403']
      };
      //throw new Error('Query.property not implemented');
    }
  }
};

module.exports = resolvers;