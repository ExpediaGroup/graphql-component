const Property = require('../property-component');
const Reviews = require('../reviews-component');

const resolvers = {
  Query: {
    async listing(_, { id }, context) {
      const [property, reviews] = await Promise.all([
        this.bindings.get(Property).query.property({ id }, `{ id, geo }`, { context }),
        this.bindings.get(Reviews).query.reviewsByPropertyId({ propertyId: id }, `{ content }`, { context })
      ]);
      return { id, property, reviews };
    }
  },
  Listing: {
    id(_) {
      throw new Error('bad id');
      //return _.id;
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