
const GraphQLComponent = require('../graphql-component');
const Property = require('../property-component');
const Reviews = require('../reviews-component');

const types = `
    # A listing
    type Listing {
      id: ID!
      geo: [String]
      reviews: [Review]
    }
`;

const rootTypes = `
    type Query {
      # Listing by id
      listing(id: ID!) : Listing @memoize
    }
`;

const resolvers = {
  Query: {
    listing(_, { id }) {
      throw new Error('Query.listing not implemented');
    }
  },
  Listing: {
    geo(_) {
      throw new Error('Listing.geo not implemented');
    }
  }
};

const fixtures = {
  Query: {
    async listing(_, { id }, context, info) {
      const [property, reviews] = await Promise.all([
        Property.Query.property({ id }, `{ geo }`, { context }),
        Reviews.Query.reviewsByPropertyId({ propertyId: id }, `{ content }`, { context })
      ]);
      return { id, property, reviews };
    }
  },
  Listing: {
    id(_) {
      return _.id;
    },
    geo(_) {
      return _.property.geo;
    },
    reviews(_) {
      return _.reviews;
    }
  }
};

module.exports = new GraphQLComponent({ types, rootTypes, resolvers, fixtures, imports: [Property, Reviews] });