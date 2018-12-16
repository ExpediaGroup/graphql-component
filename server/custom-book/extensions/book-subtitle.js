
const Book = require('../../../book-component');
const GraphQLComponent = require('../../../graphql-component');


/**
 * This is an example of a component 'trait' ...
 * It does not expose Book's root types (query, mutation, etc), 
 * but it does utilize its type definitions to extend the type defs.
 * 
 * As a result, this component will require something above it to 
 * include Book directly.
 */

const types = [`
    extend type Book {
      # The book's subtitle.
      sub: String
    }
`, ...Book.types];

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

module.exports = new GraphQLComponent({ name: 'BookWithSubtitle', types, resolvers, fixtures });
