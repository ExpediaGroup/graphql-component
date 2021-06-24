'use strict';

const resolvers = {
  Query: {
    reviewsByPropertyId(_, { propertyId }, { dataSources }) {
      return dataSources.ReviewsDataSource.getReviewsByPropertyId(propertyId);
    }
  },
  Review: {
    property() {
      return { __typename: 'Property', id: 1 };
    }
  }
};

module.exports = resolvers;
