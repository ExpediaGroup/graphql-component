
const Book = require('../../book-component');
const GraphQLComponent = require('../../graphql-component');

const types = `
    # This is a book.
    extend type Book {
      # The book's subtitle.
      sub: String
    }
`;

const resolvers = {
  Book: {
    sub() {
      throw new Error('Not implemented');
    }
  }
};

const fixtures = {
  Book: {
    sub() {
      return 'a subtitle';
    }
  }
};

module.exports = new GraphQLComponent({ name: 'BookWithSubtitle', types, resolvers, fixtures, imports: [Book] });
