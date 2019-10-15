'use strict';

const resolvers = {
  Query: {
    async listing(_, { id }, { dataSources }) {
      const [property, reviews] = await Promise.all([
        dataSources.PropertyDataSource.getPropertyById(id),
        dataSources.ReviewsDataSource.getReviewsByPropertyId(id)
      ]);

      return { 
        id, 
        propertyId: property.id,
        geo: property.geo,
        reviews
      };
    }
  }
};

module.exports = resolvers;
