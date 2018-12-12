
const GraphQLComponent = require('../lib/component');

const types = `
    # An author.
    type Author {
        id: ID!
        # The author name.
        name: String,
        # The author email.
        email: String
    }
`;

const rootTypes = `
    type Query {
        # Seach for an author by id.
        author(id: ID!, version: String) : Author
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
    async author() {
      return { id: 'an id', name: 'Test Author' };
    }
  }
};

module.exports = new GraphQLComponent({ types, rootTypes, resolvers, fixtures });