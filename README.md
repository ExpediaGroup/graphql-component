# GraphQL schema stitching and components

Reference implementation around the concept of a partial schema / component similar to that discussed [here](https://medium.com/homeaway-tech-blog/distributed-graphql-schema-development-npm-modules-d734a3cb6f12).

This example takes advantage of existing graphql stitching capabilities from Apollo, but creates a convention 
for how these schemas can be composed through imports and bindings.

This is very similar to the excellent `graphql-modules` project — but closer to our own internal paradigm already in use for over a year and a half. 

### The future

For now it is alpha, but may become an official project.

### Repository structure

- `lib` - the graphql-component code.
- `examples/example-listing/property-component` - a component implementation for `Property`.
- `examples/example-listing/reviews-component` - a component implementation for `Reviews`.
- `examples/example-listing/listing-component` - a component implementation composing `Property` and `Reviews`.
- `examples/example-listing/server` - the "application".

### Running

Can be run with `node examples/server/index.js` or `npm start` which will start with debug flags.

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
  // A string or array of strings representing typeDefs and rootTypes
  types,
  // An object containing resolver functions
  resolvers, 
  // An optional object containing resolver dev/test fixtures
  mocks,
  // An optional array of imported components for the schema to be merged with
  imports,
  // An optional object containing custom schema directives
  directives,
  // An optional object { namespace, factory } for contributing to context
  context,
  // Enable mocks
  useMocks,
  // Preserve type resolvers in mock mode
  preserveMockResolvers
});
```

This will create an instance object of a component containing the following functions:

- `schema` - getter that returns an executable schema.
- `context` - context builder.

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

### Excluding root fields from imports

You can exclude root fields from imported components:

```javascript
const { schema, context } = new GraphQLComponent({
  imports: [
    new Author(),
    {
      component: new Book(),
      exclude: ['Query.*']
    },
    new BookExtension()
  ]
});
```

This will keep from leaking unintended surface area.

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

### Context middleware

It may be necessary to transform the context before invoking component context.

```javascript
const { schema, context } = new GraphQLComponent(types, resolvers, context);

context.use('transformRawRequest', ({ request }) => {
  return { req: request.raw.req };
});
```

Using `context` now in `apollo-server-hapi` for example, will transform the context to one similar to default `apollo-server`.