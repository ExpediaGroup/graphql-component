
const GraphQLComponent = require('../graphql-component');

const types = `
    # A listing
    type Property {
      id: ID!
      geo: [String]
    }
`;

const rootTypes = `
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
      return { id: id, geo: ['41.40338', '2.17403'] };
    }
  }
};

module.exports = new GraphQLComponent({ types, rootTypes, resolvers, fixtures });