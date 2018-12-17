# GraphQL schema stitching and components

Reference implementation around the concept of a partial schema / component similar to that discussed [here](https://medium.com/homeaway-tech-blog/distributed-graphql-schema-development-npm-modules-d734a3cb6f12).

This example takes advantage of existing graphql stitching capabilities from Apollo, but creates a convention 
for how these schemas can be composed through imports and bindings.

Also provides experimental resolver caching for a request to reduce calls.

### The future

The intent of this work is to be published as a module at some point.

### Repository structure

- `graphql-component` - the GraphQLComponent and supporting code.
- `property-component` - a component instance.
- `reviews-component` - a component instance.
- `listing-component` - a component instance composing `Property` and `Reviews`.
- `server` - the "application".

### Running

Can be run with `node server/index.js`

### Debugging

Enable debug logging with `DEBUG=graphql:*`

### Activating fixtures

To intercept resolvers with mock fixtures execute your app with `GRAPHQL_DEBUG=1` enabled.

In this example it must be done since no actual resolvers is implemented.

### Usage

```javascript
new GraphQLComponent({ 
  // An optional name for this component
  name,
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
  // An optional object containing custom schema directives
  directives
});
```

This will create an instance object of a component containing the following functions:

- `name` - getter for component name, if any.
- `types` - getter that returns an array of typeDefs.
- `schema` - getter that returns an executable schema.
- `Query` - getter that returns [graphql-binding](https://github.com/graphql-binding/graphql-binding) to imported components query resolvers.
- `Mutation` - getter that returns [graphql-binding](https://github.com/graphql-binding/graphql-binding) to imported components mutation resolvers.
- `Subscription` - getter that returns [graphql-binding](https://github.com/graphql-binding/graphql-binding) to imported components subscription resolvers.
- `fixtures` - getter that returns fixtures.

### Aggregation 

Example to merge multiple components:

```javascript
const schema = new GraphQLComponent({
  imports: [
    Author,
    Book,
    BookExtension
  ]
}).schema;

const server = new ApolloServer({
    schema
});
```

This isn't necessary if you don't intend to expose another component's schema directly. You can also simply include 
another component's types in your type definitions.

For example:

```javascript
const types = [`
    extend type Book {
      author: Author
    }
`, ...Book.types, ...Author.types];

module.exports = new GraphQLComponent({ name: 'BookWithAuthorComponent', types, resolvers });
```

This doesn't require using `imports`.

NOTE: This may not be safe always and can result in type conflicts.

### Using bindings

Binding provide a way to delegate to another schema using [graphql-binding](https://github.com/graphql-binding/graphql-binding):

```javascript
const types = [`
    extend type Book {
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
```

By simply requiring the `Author` component, it becomes possible to execute the resolver `author` as a graphql call to resolve that type.

This also doesn't requiring using `import`.

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