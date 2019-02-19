
const resolvers = {
  Query: {
    property(_, { id }) {
      throw new Error('Query.property not implemented');
    }
  }
};

module.exports = resolvers;