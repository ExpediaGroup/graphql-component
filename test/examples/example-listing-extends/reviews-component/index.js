
const GraphQLComponent = require('../../../../lib/index');

class ReviewsComponent extends GraphQLComponent {
  constructor() {
    const types = `
      # A review
      type Review {
        id: ID!
        propertyId: ID!
        content: String!
      }
      type Query {
        # Reviews by property id
        reviewsByPropertyId(propertyId: ID!) : [Review] @memoize
      }
    `;

    const resolvers = {
      Query: {
        reviewsByPropertyId(_, { propertyId }) {
          return [{ id: 1, propertyId, content: 'id 1 content' }, { id: 2, propertyId, content: 'id 2 content' }];
        }
      }
    };

    super({ types, resolvers });
  }
}

module.exports = ReviewsComponent;