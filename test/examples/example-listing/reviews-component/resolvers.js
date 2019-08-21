'use strict';

const resolvers = {
  Query: {
    reviewsByPropertyId(_, { propertyId }, { providers }) {
      return providers.ReviewsProvider.getReviewsByPropertyId(propertyId);
    }
  }
};

module.exports = resolvers;
