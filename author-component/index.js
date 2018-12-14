
const GraphQLComponent = require('../graphql-component');
const Crypto = require('crypto');

const types = `
    # An author.
    type Author {
        id: ID!
        # The author name.
        name: String
        # The author email.
        email: String
    }
`;

const rootTypes = `
    type Query {
        # Seach for an author by id.
        author(id: ID!, version: String) : Author @memoize
    }
`;

const resolvers = {
  Query: {
    author(_, { id, version }) {
      throw new Error('Author not implemented');
    }
  }
};

const fixtures = {
  Query: {
    author() {
      // Expensive call
      const buffer = new Buffer(25);
      
      Crypto.randomFillSync(buffer);

      return { id: 'an id', name: 'Test Author', random: buffer };
    }
  }
};

module.exports = new GraphQLComponent({ types, rootTypes, resolvers, fixtures });