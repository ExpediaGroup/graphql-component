
const Book = require('../../book-component');
const Author = require('../../author-component');
const GraphQLComponent = require('../../graphql-component');

const types = `
    # This is a book.
    extend type Book {
      # The book's author.
      author: Author
    }
`;

const rootTypes = `
  type Query {
    # Search for a book by id.
    bookWithAuthor(id: ID!) : Book
  }
`;

const resolvers = {
  Book: {
    author(book, args, context, info) {
      return Author.bindings.query.author({ id: book.authorId }, info, { context });
    }
  }
};

module.exports = new GraphQLComponent({ types, rootTypes, resolvers, imports: [Book, Author] });
