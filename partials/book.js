
const Author = require('./author');
const Partial = require('../lib/partial');

const types = `
    # This is a book.
    type Book {
        id: ID!
        # The name of the book.
        name: String,
        # The book's author.
        author: Author
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
    book(_, { id }, { act }) {
      throw new Error('Book not implemented');
    }
  },
  Book: {
    author(book, args, context, info) {
      return Author.bindings.query.author({ id: book.author_id }, info, { context });
    }
  }
};

const fixtures = {
  Query: {
    book() {
      return { id: 'an id', name: 'Test Book', author_id: 'author id' };
    }
  }
};

module.exports = new Partial({ types, rootTypes, resolvers, imports: [Author], fixtures });
