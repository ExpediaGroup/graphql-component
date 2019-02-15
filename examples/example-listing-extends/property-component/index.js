
const GraphQLComponent = require('../../../lib/index');

class PropertyComponent extends GraphQLComponent {
  constructor({ useFixtures }) {
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
          throw new Error('Query.property not implemented');
        }
      }
    };

    const fixtures = {
      Query: {
        property(_, { id }) {
          return { id: id, owner: 'Floyd' };
        }
      }
    };

    super({ types, resolvers, fixtures, useFixtures });
  }
}

module.exports = PropertyComponent;