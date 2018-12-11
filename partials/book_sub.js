
const Book = require('./book');
const Partial = require('../lib/partial');

const types = `
    # This is a book.
    extend type Book {
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

module.exports = new Partial({ types, resolvers, imports: [Book], fixtures });
