
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

const resolvers = {
  Book: {
    author(book, args, context, info) {
      console.log(info.rootValue)
      return Author.bindings.query.author({ id: book.authorId }, info, { context });
    }
  }
};

module.exports = new GraphQLComponent({ types, resolvers, imports: [Book, Author] });
