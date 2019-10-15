[![Build Status](https://dev.azure.com/tlivings0149/Trevor%20Livingston/_apis/build/status/tlivings.graphql-component?branchName=master)](https://dev.azure.com/tlivings0149/Trevor%20Livingston/_build/latest?definitionId=1&branchName=master)

# GraphQL schema components.

This project is designed to make module or component based development of graphql schemas easy.

Read more about the idea [here](https://medium.com/@tlivings/graphql-component-architecture-principles-homeaway-ede8a58d6fde): 

This is very similar to the excellent `graphql-modules` project — but a little closer to our own internal paradigm already in use for over a year and a half and adds some features such as `exclude` root types from `imports` and memoize resolvers.

In fact, this module utilizes the `graphql-toolkit` developed by the `graphql-modules` team to merge types and resolvers.

### The future

Experimental / alpha for now.

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

# API

- `GraphQLComponent(options)` - the component class, which may also be extended. Its options include:
  - `types` - a string or array of strings representing typeDefs and rootTypes.
  - `resolvers` - an object containing resolver functions.
  - `imports` - an optional array of imported components for the schema to be merged with.
  - `context` - an optional object { namespace, factory } for contributing to context.
  - `directives` - an optional object containing custom schema directives.
  - `useMocks` - enable mocks.
  - `preserveMockResolvers` - preserve type resolvers in mock mode.
  - `mocks` - an optional object containing mock types.
  - `dataSources` - an array of data sources instances to make available on `context.dataSources` .
  - `dataSourceOverrides` - overrides for data sources in the component tree.

A new GraphQLComponent instance has the following API:

- `schema` - getter that returns an executable schema representing the entire component tree.
- `context` - context function that build context for all components in the tree.
- `schemaDirectives` - schema directives for the entire component tree.
- `execute` - accepts a graphql query to execute agains `schema`.
- `types` - this component's types.
- `resolvers` - this component's resolvers.
- `imports` - this component's imported components.
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
  constructor({ useMocks, preserveTypeResolvers }) {
    super({ types, resolvers, mocks, useMocks, preserveTypeResolvers });
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
  get name() {
    return 'PropertyDataSource';
  }
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

### Directly executing components

Components can be directly executed via the `execute` function. The `execute` function is basically a passthrough to `graphql.execute` and is mostly useful for components calling imported components and the like.

For example, this allows one component to invoke another component and still get the benefits of that component's schema type resolvers and validation.

`execute(input, options)` accepts an `input` string and an optional `options` object with the following fields:

- `root` - root object.
- `context` - context object value.
- `variables` - key:value mapping of variables for the input.

The `execute` function also adds some helper fragments. For any type you query in a component, a helper fragment will exist to query all fields.

Example extending `Property` to include a `reviews` field that delegates to another component:

```javascript
class PropertyComponentReviews extends GraphQLComponent {
  constructor({ useMocks, preserveTypeResolvers }) {
    const propertyComponent = new PropertyComponent();
    const reviewsComponent = new ReviewsComponent();

    super ({
      types: [
        `type Property { reviews: [Review] }`
      ],
      resolvers: {
        Property: {
          reviews(_, args, context) {
            //TODO: error handle here of course!
            return reviewsComponent.execute(`query { reviewsByPropertyId(id: ${_.id}) { ...AllReview }}`, { context });
          }
        }
      },
      imports: [
        propertyComponent,
        {
          component: reviewsComponent,
          exclude: ['*'] //Exclude the imported component's API
        }
      ]
    });
  }
}
```

For the `Review` type in the `reviewsComponent`, a helper fragment will exist as `AllReview` that provides all fields.

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

### Mocks

graphql-component accepts mocks in much the same way that Apollo does but with one difference.

Instead of accepting a mocks object, it accepts `(importedMocks) => mocksObject` argument. This allows components to utilize the mocks from other imported components easily.
