# GraphQL schema stitching and components

Reference implementation around the concept of a partial schema / component similar to that discussed [here](https://medium.com/homeaway-tech-blog/distributed-graphql-schema-development-npm-modules-d734a3cb6f12).

This example takes advantage of existing graphql stitching capabilities from Apollo, but creates a convention 
for how these schemas can be composed through imports and bindings.

Also provides experimental resolver caching for a request to reduce calls.

### The future

The intent of this work is to be published as a module at some point. For now it is published as an alpha.

### Repository structure

- `examples/property-component` - a component implementation.
- `examples/reviews-component` - a component implementation.
- `examples/listing-component` - a component implementation composing `Property` and `Reviews`.
- `examples/server` - the "application".

### Running

Can be run with `node examples/server/index.js`

### Debugging

Enable debug logging with `DEBUG=graphql-component:*`

### Activating fixtures

To intercept resolvers with mock fixtures execute this app with `GRAPHQL_DEBUG=1` enabled.

In this example it must be done since no actual resolvers is implemented (with the exception of listing).

This works much like Apollo's `addMockFunctionsToSchema` but functions better for this use case 
because it will continue to use resolver when a fixture isn't present and the fixtures preserve the 
memoization.

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
  imports,
  // An optional object containing custom schema directives
  directives,
  // An optional object { namespace, factory } for contributing to context
  context,
  // Enable fixtures
  useFixtures
});
```

This will create an instance object of a component containing the following functions:

- `schema` - getter that returns an executable schema.
- `context` - context builder.
- `importBindings` - provides a map to [graphql-binding](https://github.com/graphql-binding/graphql-binding)'s create by `imports`.

### Aggregation 

Example to merge multiple components:

```javascript
const { schema, context } = new GraphQLComponent({
  imports: [
    new Author(),
    new Book(),
    new BookExtension()
  ]
});

const server = new ApolloServer({
    schema,
    context
});
```

This isn't necessary if you don't intend to expose another component's schema directly. You can also simply include 
another component's types in your type definitions.

For example:

```javascript
class BookWithAuthorComponent extends GraphQLComponent {
  constructor() {
    const types = [`
      extend type Book {
        author: Author
      }
    `, ...Book.types, ...Author.types];

    //etc...

    super({ types, resolvers, /*etc*/ });
  }
}

module.exports = BookWithAuthorComponent;
```

This doesn't require using `imports`.

NOTE: This may not be safe always and can result in type conflicts.

### Using bindings

Binding provide a way to delegate to another schema using [graphql-binding](https://github.com/graphql-binding/graphql-binding):

```javascript
const resolvers = {
  Book: {
    author(book, args, context, info) {
      return this.importBindings.get(Author).query.author({ id: book.authorId }, info, { context });
    }
  }
};
```

By simply importing an `Author` component instance, it becomes possible to execute the resolver `author` as a graphql call to resolve that type.

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

### Adding to context

Example context argument:

```javascript
const context = {
  namespace: 'myNamespace',
  factory: function (request) {
    return 'my value';
  }
};
```