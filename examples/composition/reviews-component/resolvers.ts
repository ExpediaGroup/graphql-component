
export const resolvers = {
  Query: {
    reviewsByPropertyId(_, { propertyId }, { dataSources }) {
      return dataSources.ReviewsDataSource.getReviewsByPropertyId(propertyId);
    }
  }
};
