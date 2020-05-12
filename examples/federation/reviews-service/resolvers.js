'use strict';

const resolvers = {
  Query: {
    reviewsByPropertyId(_, { propertyId }, { dataSources }) {
      return dataSources.ReviewsDataSource.getReviewsByPropertyId(propertyId);
    }
  },
  Property: {
    reviews(property, args, { dataSources }) {
      return dataSources.ReviewsDataSource.getReviewsByPropertyId(property.id);
    }
  }
};

module.exports = resolvers;
