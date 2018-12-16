
const Book = require('../../../book-component');
const Author = require('../../../author-component');
const GraphQLComponent = require('../../../graphql-component');

/**
 * This is an example of a component 'trait' ...
 * It does not expose Book or Author's root types (query, mutation, etc), 
 * but it does utilize its type definitions to extend the type defs.
 * 
 * As a result, this component will require something above it to 
 * include Book and Author directly.
 */

const types = [`
    extend type Book {
      # The book's author.
      author: Author
    }
`, ...Book.types, ...Author.types];

const resolvers = {
  Book: {
    author(book, args, context, info) {
      return Author.Query.author({ id: book.authorId }, info, { context });
    }
  }
};

module.exports = new GraphQLComponent({ name: 'BookWithAuthorComponent', types, resolvers });
