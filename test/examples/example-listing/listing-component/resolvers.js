'use strict';

const Property = require('../property-component');
const Reviews = require('../reviews-component');

const resolvers = {
  Query: {
    async listing(_, { id }, context) {
      const [propertyResult, reviewsResult] = await Promise.all([
        this.propertyComponent.execute(`query { property(id: ${id}) { id, geo }}`, { context }),
        this.reviewsComponent.execute(`query { reviewsByPropertyId(propertyId: ${id}) { content }}`, { context })
      ]);

      if (propertyResult.errors) {
        throw propertyResult.errors[0];
      }
      if (reviewsResult.errors) {
        throw reviewsResult.errors[0];
      }

      return { id, property: propertyResult.data.property, reviews: reviewsResult.data.reviewsByPropertyId };
    }
  },
  Listing: {
    id(_) {
      return _.id;
    },
    propertyId(_) {
      return _.property.id;
    },
    geo(_) {
      return _.property.geo;
    },
    reviews(_) {
      return _.reviews;
    }
  }
};

module.exports = resolvers;
