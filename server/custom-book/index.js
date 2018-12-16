
const Book = require('../../book-component');
const BookAuthor = require('./extensions/book-author');
const BookSubtitle = require('./extensions/book-subtitle');
const GraphQLComponent = require('../../graphql-component');

module.exports = new GraphQLComponent({ imports: [ Book, BookAuthor, BookSubtitle ] });