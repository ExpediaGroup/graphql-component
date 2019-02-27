
const GraphQLComponent = require('../../../lib/index');

class PropertyComponent extends GraphQLComponent {
  constructor() {
    const types = `
      # A listing
      type Property {
        id: ID!
        owner: String
      }
      type Query {
        # Property by id
        property(id: ID!) : Property @memoize
      }
    `;

    const resolvers = {
      Query: {
        property(_, { id }) {
          return { id: id, owner: 'Floyd' };
        }
      }
    };

    super({ types, resolvers });
  }
}

module.exports = PropertyComponent;