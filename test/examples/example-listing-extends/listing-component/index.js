
const GraphQLComponent = require('../../../../lib/index');
const Property = require('../property-component');
const Reviews = require('../reviews-component');
const { Binding } = require('graphql-binding');

class ListingComponent extends GraphQLComponent {
  constructor() {
    const types = `
      type Property {
        # Geo added by ListingComponent
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
      },
      Property: {
        geo() {
          return ['41.40338', '2.17403'];
        }
      }
    };

    const propertyComponent = new Property();
    const reviewsComponent = new Reviews();

    super ({ 
      types,
      resolvers, 
      imports: [
        {
          component: propertyComponent,
          exclude: ['Query.*']
        },
        {
          component: reviewsComponent,
          exclude: ['Query.*']
        }
      ] 
    });

    this.bindings = new WeakMap();
    this.bindings.set(Property, new Binding({ schema: propertyComponent.schema }));
    this.bindings.set(Reviews, new Binding({ schema: reviewsComponent.schema }));
  }
}

module.exports = ListingComponent;