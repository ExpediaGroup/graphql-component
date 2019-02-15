
const GraphQLComponent = require('../../../lib/index');
const Property = require('../property-component');
const Reviews = require('../reviews-component');

class ListingComponent extends GraphQLComponent {
  constructor({ useFixtures }) {
    const types = `
      extend type Property {
        geo: [String]
      }
      # A listing
      type Listing {
        id: ID!
        property: Property
        reviews: [Review]
      }
      type Query {
        # Listing by id
        listing(id: ID!) : Listing @memoize
      }
    `;

    const resolvers = {
      Query: {
        async listing(_, { id }, context) {
          const [property, reviews] = await Promise.all([
            this.bindings.get(Property).query.property({ id }, `{ id, owner }`, { context }),
            this.bindings.get(Reviews).query.reviewsByPropertyId({ propertyId: id }, `{ content }`, { context })
          ]);
          return { id, property, reviews };
        }
      },
      Listing: {
        id(_) {
          return _.id;
        },
        property(_) {
          return _.property;
        },
        reviews(_) {
          return _.reviews;
        }
      }
    };

    const fixtures = {
      Property: {
        geo() {
          return ['41.40338', '2.17403'];
        }
      }
    };

    super ({ 
      types, 
      resolvers, 
      fixtures,
      imports: [
        { 
          component: new Property({ useFixtures }), 
          exclude: ['Query.*'] 
        }, 
        { 
          component: new Reviews({ useFixtures }), 
          exclude: ['Query.*']
        } 
      ],
      useFixtures
    });
  }
}

module.exports = ListingComponent;