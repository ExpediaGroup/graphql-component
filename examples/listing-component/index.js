
const GraphQLComponent = require('../../lib/index');
const Property = require('../property-component');
const Reviews = require('../reviews-component');

class ListingComponent extends GraphQLComponent {
  constructor({ useFixtures }) {
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
        async listing(_, { id }, context) {
          const [property, reviews] = await Promise.all([
            this.importBindings.get(Property).query.property({ id }, `{ geo }`, { context }),
            this.importBindings.get(Reviews).query.reviewsByPropertyId({ propertyId: id }, `{ content }`, { context })
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

    super ({ types, rootTypes, resolvers, imports: [new Property({ useFixtures }), new Reviews({ useFixtures })] });
  }
}

module.exports = ListingComponent;