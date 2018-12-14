# GraphQL schema stitching and components

Reference implementation around the concept of a partial schema / component similar to that discussed [here](https://medium.com/homeaway-tech-blog/distributed-graphql-schema-development-npm-modules-d734a3cb6f12).

This example takes advantage of existing graphql stitching capabilities from Apollo, but creates a convention 
for how these schemas can be composed through imports and bindings.

Also provides experimental resolver caching for a request to reduce calls.

### The future

The intent of this work is to be published as a module at some point.

### Repository structure

- `graphql-component` - the GraphQLComponent and supporting code.
- `author-component` - a component instance.
- `book-component` - a component instance.
- `server` - the "application" which includes a composition of `Author` and `Book`.

### Running

Can be run with `node server/index.js`

### Debugging

Enable debug logging with `DEBUG=graphql:*`

### Activating fixtures

To intercept resolvers with mock fixtures execute your app with `GRAPHQL_DEBUG=1` enabled.

### Usage

```javascript
new GraphQLComponent({ 
  // A string or array of strings representing typeDefs
  types,
  // A string or array of strings reprenting rootTypes
  rootTypes,
  // An object containing resolver functions
  resolvers, 
  // An optional object containing resolver dev/test fixtures
  fixtures,
  // An optional array of imported components for the schema to be merged with
  imports
});
```

This will create an instance object of a component containing the following functions:

- `types` - getter that returns an array of typeDefs.
- `rootTypes` - getter that returns an array of rootTypes.
- `importedTypes` - getter that returns an array of imported types.
- `resolvers` - getter that returns resolvers.
- `schema` - getter that returns an executable schema.
- `Query` - getter that returns [graphql-binding](https://github.com/graphql-binding/graphql-binding) to imported components query resolvers.
- `Mutation` - getter that returns [graphql-binding](https://github.com/graphql-binding/graphql-binding) to imported components mutation resolvers.
- `Subscription` - getter that returns [graphql-binding](https://github.com/graphql-binding/graphql-binding) to imported components subscription resolvers.
- `fixtures` - getter that returns fixtures.

### Using bindings

As seen in [book.js](server/custom/book.js):

```javascript
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
      return Author.Query.author({ id: book.authorId }, info, { context });
    }
  }
};

module.exports = new GraphQLComponent({ types, resolvers, imports: [Book, Author] });
```

By simply requiring the `Author` component, it becomes possible to execute the resolver `author` as a graphql call to resolve that type.

### Resolver memoization

Schemas in graphql components will support the `@memoize` directive. This will allow resolvers to be memoized within the 
scope of a particular request context to reduce the number of times a resolver must run for the same data.

Example:

```graphql
type Query {
    # Seach for an author by id.
    author(id: ID!, version: String) : Author @memoize
}
```