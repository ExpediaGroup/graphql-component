# GraphQL schema stitching and components

Introduces the concept of a partial similar to that discussed [here](https://medium.com/homeaway-tech-blog/distributed-graphql-schema-development-npm-modules-d734a3cb6f12).

This example takes advantage of existing graphql stitching capabilities from Apollo, but creates a convention 
for how these schemas can be composed through imports and bindings.

Also provides experimental resolver caching for a request to reduce calls.

### List of potential problems / todo

- Using require to declare import dependency is handy but could create circular dependencies. May be best
to come in on context after all.
- No opportunity currently for factory or construction. Solvable by wrapping the component instance.
- Memoization of resolvers needs to be tested more.

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
  // An optional array of imported components
  imports
});
```

This will create an instance object of a component containing the following functions:

- `types` - getter that returns an array of typeDefs.
- `rootTypes` - getter that returns an array of rootTypes.
- `importedTypes` - getter that returns an array of imported types.
- `resolvers` - getter that returns resolvers.
- `schema` - getter that returns an executable schema.
- `bindings` - getter that returns [graphql-binding](https://github.com/graphql-binding/graphql-binding) to imported components resolvers.
- `fixtures` - getter that returns fixtures.

### Activating fixtures

To intercept resolvers with fixtures execute your app with `GRAPHQL_DEBUG=1` enabled.

### Resolver caching

Currently, this example is experimenting with intercepting resolvers and executing a 
memoized version of the resolver within the scope of a particular request's `context`.

### Debugging

Enable debug logging with `DEBUG=graphql:*`