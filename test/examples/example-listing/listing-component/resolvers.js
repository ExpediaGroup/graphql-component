'use strict';

const resolvers = {
  Query: {
    async listing(_, { id }, { providers }) {
      const [property, reviews] = await Promise.all([
        providers.PropertyProvider.getPropertyById(id),
        providers.ReviewsProvider.getReviewsByPropertyId(id)
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
