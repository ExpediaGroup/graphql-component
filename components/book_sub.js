
const Book = require('./book');
const GraphQLComponent = require('../lib/component');

const types = `
    # This is a book.
    extend type Book {
        # Attribute extended from base type
        subTitle: String
    }
`;

const resolvers = {
  Book: {
    subTitle(/*book, args, context, info*/) {
      throw new Error('Book.subTitle not implemented');
    }
  }
};

const fixtures = {
  Book: {
    subTitle() {
      return 'a subtitle';
    }
  }
};

module.exports = new GraphQLComponent({ types, resolvers, imports: [Book], fixtures });
