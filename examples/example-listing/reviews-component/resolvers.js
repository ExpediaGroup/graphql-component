
const resolvers = {
  Query: {
    reviewsByPropertyId(_, { propertyId }) {
      throw new Error('Query.reviewsByPropertyId not implemented');
    }
  }
};

module.exports = resolvers;