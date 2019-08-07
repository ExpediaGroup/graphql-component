'use strict';

const ReviewsProvider = require('./provider');

const resolvers = {
  Query: {
    reviewsByPropertyId(_, { propertyId }, { providers }) {
      return providers.get(ReviewsProvider).getReviewsByPropertyId(propertyId);
    }
  }
};

module.exports = resolvers;
