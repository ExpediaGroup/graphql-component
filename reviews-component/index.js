
const GraphQLComponent = require('../graphql-component');

const types = `
    # A review
    type Review {
      id: ID!
      propertyId: ID!
      content: String!
    }
`;

const rootTypes = `
    type Query {
      # Reviews by property id
      reviewsByPropertyId(propertyId: ID!) : [Review] @memoize
    }
`;

const resolvers = {
  Query: {
    reviewsByPropertyId(_, { propertyId }) {
      throw new Error('Query.reviewsByPropertyId not implemented');
    }
  }
};

const fixtures = {
  Query: {
    reviewsByPropertyId(_, { propertyId }) {
      return [{ id: 1, propertyId, content: 'id 1 content' }, { id: 2, propertyId, content: 'id 2 content' }];
    }
  }
};

module.exports = new GraphQLComponent({ types, rootTypes, resolvers, fixtures });