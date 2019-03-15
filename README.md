# GraphQL schema components

Reference implementation around the concept of a partial schema / component similar to that discussed [here](https://medium.com/homeaway-tech-blog/distributed-graphql-schema-development-npm-modules-d734a3cb6f12).

This is very similar to the excellent `graphql-modules` project — but closer to our own internal paradigm already in use for over a year and a half and adds some missing features such as `exclude` from `imports`.

### The future

For now it is alpha and experimental.

### Repository structure

- `lib` - the graphql-component code.
- `test/examples/example-listing/property-component` - a component implementation for `Property`.
- `test/examples/example-listing/reviews-component` - a component implementation for `Reviews`.
- `test/examples/example-listing/listing-component` - a component implementation composing `Property` and `Reviews`.
- `test/examples/example-listing/server` - the "application".

### Running the example

Can be run with `node examples/server/index.js` or `npm start` which will start with debug flags.

### Debugging

Enable debug logging with `DEBUG=graphql-component:*`

### Activating mocks

To intercept resolvers with mocks execute this app with `GRAPHQL_DEBUG=1` enabled.

In this example it must be done since no actual resolvers are implemented (with the exception of listing).

# Usage

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

### Encapsulating state

Typically the best way to make a re-useable component will be to extend `GraphQLComponent`. 

```javascript
const GraphQLComponent = require('graphql-component');
const Resolvers = require('./resolvers');
const Types = require('./types');
const Mocks = require('./mocks');

class PropertyComponent extends GraphQLComponent {
  constructor({ useMocks, preserveTypeResolvers }) {
    super({ types: Types, resolvers: Resolvers, mocks: Mocks, useMocks, preserveTypeResolvers });
  }
}

module.exports = PropertyComponent;
```

This will allow for configuration (in this example, `useMocks` and `preserveTypeResolvers`) as well as instance data per component (such as data base clients, etc).

### Aggregation 

Example to merge multiple components:

```javascript
const { schema, context } = new GraphQLComponent({
  imports: [
    new Property(),
    new Reviews()
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
    {
      component: new Property(),
      exclude: ['Mutation.*']
    },
    {
      component: new Reviews(),
      exclude: ['Mutation.*']
    }
  ]
});
```

This will keep from leaking unintended surface area.

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
  factory: function ({ req }) {
    return 'my value';
  }
};
```

### Context middleware

It may be necessary to transform the context before invoking component context.

```javascript
const { schema, context } = new GraphQLComponent({types, resolvers, context});

context.use('transformRawRequest', ({ request }) => {
  return { req: request.raw.req };
});
```

Using `context` now in `apollo-server-hapi` for example, will transform the context to one similar to default `apollo-server`.