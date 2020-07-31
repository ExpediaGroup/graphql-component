![](https://github.com/ExpediaGroup/graphql-component/workflows/Build/badge.svg)

# GraphQL schema components.

This project is designed to make npm module or component based Node.js development of graphql schemas easy.

Read more about the idea [here](https://medium.com/expedia-group-tech/graphql-component-architecture-principles-homeaway-ede8a58d6fde).

`graphql-component` lets you built a schema progressively through a tree of graphql schema dependencies.

### Repository structure

- `lib` - the graphql-component code.
- `test/examples/example-listing/property-component` - a component implementation for `Property`.
- `test/examples/example-listing/reviews-component` - a component implementation for `Reviews`.
- `test/examples/example-listing/listing-component` - a component implementation composing `Property` and `Reviews` into a new `Listing`.
- `test/examples/example-listing/server` - the "application".

### Running the example

Can be run with `npm start` which will start with debug flags.

### Debug output

Generally enable debug logging with `DEBUG=graphql-component:*`

### Activating mocks

To intercept resolvers with mocks execute this app with `GRAPHQL_MOCK=1` enabled or simply run `npm start-mock`.

# API

- `GraphQLComponent(options)` - the component class, which may also be extended. Its options include:
  - `types` - a string or array of strings representing typeDefs and rootTypes.
  - `resolvers` - an object containing resolver functions.
  - `imports` - an optional array of imported components for the schema to be merged with.
  - `context` - an optional object { namespace, factory } for contributing to context.
  - `directives` - an optional object containing custom schema directives.
  - `useMocks` - enable mocks.
  - `preserveResolvers` - dont replace provided actual resolvers with mocks (custom or default), enables mocking parts of a schema
  - `mocks` - an optional object containing mock types.
  - `dataSources` - an array of data sources instances to make available on `context.dataSources` .
  - `dataSourceOverrides` - overrides for data sources in the component tree.
  - `federation` - enable building a federated schema (default: `false`).
- `GraphQLComponent.delegateToComponent(component, options)` - helper for delegating a sub-query to another component
  - `component` - the component to delegate to.
  - `options` - additional options:
    - `subPath` - optional subPath to extract sub-query from
    - `contextValue` - the context (required).
    - `info` - the info object from the calling resolver (required).

A new GraphQLComponent instance has the following API:

- `schema` - getter that returns an executable schema representing the entire component tree.
- `context` - context function that build context for all components in the tree.
- `types` - this component's types.
- `resolvers` - this component's resolvers.
- `imports` - this component's imported components or a import configuration.
- `mocks` - custom mocks for this component.
- `directives` - this component's directives.
- `dataSources` - this component's data source(s), if any.

# General usage

Creating a component using the GraphQLComponent class:

```javascript
const GraphQLComponent = require('graphql-component');

const { schema, context } = new GraphQLComponent({ types, resolvers });
```

### Encapsulating state

Typically the best way to make a re-useable component with instance data will be to extend `GraphQLComponent`.

```javascript
const GraphQLComponent = require('graphql-component');
const resolvers = require('./resolvers');
const types = require('./types');
const mocks = require('./mocks');

class PropertyComponent extends GraphQLComponent {
  constructor({ useMocks, preserveResolvers }) {
    super({ types, resolvers, mocks, useMocks, preserveResolvers });
  }
}

module.exports = PropertyComponent;
```

This will allow for configuration (in this example, `useMocks` and `preserveResolvers`) as well as instance data per component (such as data base clients, etc).

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

### Import configuration

Imports can be a configuration object supplying the following properties:

- `component` - the component instance to import.
- `exclude` - fields, if any, to exclude.

### Exclude

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

This will keep from leaking unintended surface area. But you can still delegate calls to the component's schema to enable it from the API you do expose.

### Data Source support

Data sources in `graphql-component` do not extend `apollo-datasource`'s `DataSource` class.

Instead, data sources in components will be injected into the context, but wrapped in a proxy such that the global 
context will be injected as the first argument of any function implemented in a data source class.

This allows there to exist one instance of a data source for caching or other statefullness (like circuit breakers), 
while still ensuring that a data source will have the current context.

For example, a data source should be implemented like:

```javascript
class PropertyDataSource {
  async getPropertyById(context, id) {
    //do some work...
  }
}
```

This data source would be executed without passing the `context` manually:

```javascript
const resolvers = {
  Query: {
    property(_, { id }, { dataSources }) {
      return dataSources.PropertyDataSource.getPropertyById(id);
    }
  }
}
```

Setting up a component to use a data source might look like:

```javascript
new GraphQLComponent({
  //...
  dataSources: [new PropertyDataSource()]
})
```

### Override data sources

Since data sources are added to the context based on the constructor name, it is possible to simply override data sources by passing the same class name or overriding the constructor name:

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
  ],
  dataSourceOverrides: [
    new class PropertyMock {
      static get name() {
        return 'PropertyDataSource';
      }
      //...etc
    }
  ]
});
```

### Decorating the global context

Example context argument:

```javascript
const context = {
  namespace: 'myNamespace',
  factory: function ({ req }) {
    return 'my value';
  }
};
```

After this, resolver `context` will contain `{ ..., myNamespace: 'my value' }`.

### Context middleware

It may be necessary to transform the context before invoking component context.

```javascript
const { schema, context } = new GraphQLComponent({types, resolvers, context});

context.use('transformRawRequest', ({ request }) => {
  return { req: request.raw.req };
});
```

Using `context` now in `apollo-server-hapi` for example, will transform the context to one similar to default `apollo-server`.

### Delegating root-type operations to a component
GraphQLComponent exposes a static function called `delegateToComponent` that provides functionality for delegating execution of a operation (ie. `query`, `mutation`) to a given component. In general, delegateToComponent is meant to be somewhat opinionated/restrictive in order to encourage more formal links or connections between types defined in seperate components. `delegateToComponent` can be called from a component's root or non-root type field resolvers.

#### static delegateToComponent(component, options) => delegated graphql execution result
* component: the component to delegate execution to
* options: an object whose properties facilitate delegation of a graphql operation to the input component
  * `contextValue` (required): the `context` object from resolver that calls `delegateToComponent`
  * `info` (required): the `info` object from the resolver that calls `delegateToComponent`
  * `targetRootField` (`string`, optional): if the calling resolver's field name is different from the root field name on the delegatee, you can specify the desired root field on the delegatee that you want to execute
  * `subPath` (`string`, optional): dot separated string designating a path into the incoming selection set that will limit the selection set in delegated operation



