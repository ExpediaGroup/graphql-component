'use strict';

const resolvers = {
  Query: {
    reviewsByPropertyId(_, { propertyId }, { dataSources }) {
      return dataSources.ReviewsDataSource.getReviewsByPropertyId(propertyId);
    }
  },
  Property: {
    reviews(root, _args, { dataSources }) {
      return dataSources.ReviewsDataSource.getReviewsByPropertyId(root.id);
    }
  }
};

module.exports = resolvers;