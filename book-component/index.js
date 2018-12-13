
const GraphQLComponent = require('../graphql-component');

const types = `
    # This is a book.
    type Book {
        id: ID!
        # The name of the book.
        name: String
    }
`;

const rootTypes = `
    type Query {
        # Search for a book by id.
        book(id: ID!) : Book
    }
`;

const resolvers = {
  Query: {
    book(_, { id }) {
      throw new Error('Book not implemented');
    }
  }
};

const fixtures = {
  Query: {
    async book() {
      return { id: 'an id', name: 'Test Book', authorId: 'author id' };
    }
  }
};

module.exports = new GraphQLComponent({ types, rootTypes, resolvers, fixtures });
