# GraphQL Component

![Build Status](https://github.com/ExpediaGroup/graphql-component/workflows/Build/badge.svg)

A library for building GraphQL schemas through composable, self-contained components.

Each component owns its types, resolvers, data sources, and context. Components compose into larger schemas via [`@graphql-tools/stitch`](https://the-guild.dev/graphql/tools/docs/schema-stitching/stitch-combining-schemas), and standalone components can also build [Apollo Federation](https://www.apollographql.com/docs/federation/) subgraphs.

Read more about the architecture in the [blog post](https://medium.com/expedia-group-tech/graphql-component-architecture-principles-homeaway-ede8a58d6fde).

## Install

```bash
npm install graphql-component
```

Requires `graphql ^16.0.0` as a peer dependency.

## Basic Usage

```typescript
import GraphQLComponent from 'graphql-component';

const component = new GraphQLComponent({
  types: `
    type Query {
      property(id: ID!): Property
    }
    type Property {
      id: ID!
      name: String
    }
  `,
  resolvers: {
    Query: {
      property(_, { id }) {
        return { id, name: 'Beach House' };
      }
    }
  }
});

const { schema, context } = component;
```

Both CommonJS (`require('graphql-component')`) and ES module imports work.

## Composing Components

Parent components import children. The resulting schema merges all types and resolvers through schema stitching.

```typescript
const property = new GraphQLComponent({
  types: propertyTypes,
  resolvers: propertyResolvers,
  dataSources: [new PropertyDataSource()]
});

const reviews = new GraphQLComponent({
  types: reviewTypes,
  resolvers: reviewResolvers,
  dataSources: [new ReviewsDataSource()]
});

const gateway = new GraphQLComponent({
  types: gatewayTypes,
  resolvers: gatewayResolvers,
  imports: [property, reviews]
});

const server = new ApolloServer({
  schema: gateway.schema,
  context: gateway.context
});
```

Import entries can also be configuration objects for advanced stitching scenarios:

```typescript
imports: [
  {
    component: property,
    configuration: { /* SubschemaConfig options */ }
  }
]
```

## Data Sources

Data sources use a proxy system to inject per-request context automatically. You define methods with context as the first parameter, but callers never pass it directly.

```typescript
import GraphQLComponent, {
  DataSourceDefinition,
  ComponentContext
} from 'graphql-component';

class UsersDataSource implements DataSourceDefinition<UsersDataSource> {
  name = 'users';

  async getUserById(context: ComponentContext, id: string) {
    const token = context.auth?.token;
    return fetchUser(id, token);
  }
}

const resolvers = {
  Query: {
    user(_, { id }, context) {
      // context is injected by the proxy; just pass the remaining args
      return context.dataSources.users.getUserById(id);
    }
  }
};

const component = new GraphQLComponent({
  types,
  resolvers,
  dataSources: [new UsersDataSource()]
});
```

Two type helpers support this pattern:

- `DataSourceDefinition<T>` for the implementation side, where context is the first parameter.
- `DataSource<T>` for the consumption side, where context is stripped.

For the full guide covering both injected and private data source patterns, overrides, testing strategies, and common pitfalls, see [DATASOURCES.md](./DATASOURCES.md).

## Context and Middleware

Components support context middleware that runs before the component's own context is built. Middleware receives the accumulated context and returns a transformed version.

```typescript
const component = new GraphQLComponent({ types, resolvers });

component.context.use('auth', async (context) => {
  const user = await authenticate(context.req?.headers?.authorization);
  return { ...context, user };
});

component.context.use('logging', async (context) => {
  logger.info('request', { requestId: context.requestId });
  return context;
});
```

Middleware runs in registration order, and each step receives the output of the previous one. The full context flow is: data source injection, import data source injection, middleware, import context resolution (parallel), then namespace application.

Components can namespace their context contribution:

```typescript
const component = new GraphQLComponent({
  types,
  resolvers,
  context: {
    namespace: 'property',
    factory: async (context) => ({ locale: context.locale })
  }
});
```

## Federation

Set `federation: true` to build an Apollo Federation subgraph instead of a standalone schema:

```typescript
const component = new GraphQLComponent({
  types,
  resolvers,
  federation: true
});
```

This switches schema construction from `makeExecutableSchema()` to `buildFederatedSchema()`. The federation flag is per-component; a parent does not propagate it to imported children.

## Mocking

Pass `mocks: true` for default mocks, or provide a mock map:

```typescript
const component = new GraphQLComponent({
  types,
  resolvers,
  mocks: {
    Property: () => ({
      id: '1',
      name: 'Test Property'
    })
  }
});
```

Mocks are applied via [`@graphql-tools/mock`](https://the-guild.dev/graphql/tools/docs/mocking).

## Schema Transforms

Transforms are `SchemaMapper` functions from `@graphql-tools/utils`, applied after schema construction:

```typescript
const component = new GraphQLComponent({
  types,
  resolvers,
  transforms: [
    {
      'MapperKind.OBJECT_FIELD': (fieldConfig) => {
        // modify field config
        return fieldConfig;
      }
    }
  ]
});
```

## Schema Pruning

Remove unused types from the constructed schema:

```typescript
const component = new GraphQLComponent({
  types,
  resolvers,
  pruneSchema: true,
  pruneSchemaOptions: { /* PruneSchemaOptions */ }
});
```

## API

### Constructor Options

| Option | Type | Description |
|---|---|---|
| `types` | `string \| string[]` | GraphQL SDL type definitions |
| `resolvers` | `object` | Resolver map. Query resolvers are memoized per-request; mutations and subscriptions are not. |
| `imports` | `Array<Component \| ConfigObject>` | Child components to stitch into this schema |
| `context` | `{ namespace, factory }` | Context namespace and factory function |
| `dataSources` | `Array<IDataSource>` | Data source instances for automatic context injection |
| `dataSourceOverrides` | `Array<IDataSource>` | Replace default data sources (useful in tests) |
| `mocks` | `boolean \| IMocks` | Enable default or custom mocking |
| `federation` | `boolean` | Build as Apollo Federation subgraph (default: `false`) |
| `pruneSchema` | `boolean` | Remove unused types (default: `false`) |
| `pruneSchemaOptions` | `PruneSchemaOptions` | Options for schema pruning |
| `transforms` | `Array<SchemaMapper>` | Schema transformation functions |

### Instance Properties

| Property | Type | Description |
|---|---|---|
| `name` | `string` | Component name (derived from class name) |
| `schema` | `GraphQLSchema` | The constructed, cached schema |
| `context` | `IContextWrapper` | Context function with `.use()` for middleware |
| `types` | `TypeSource` | The component's type definitions |
| `resolvers` | `IResolvers` | The component's resolver map |
| `imports` | `Array` | Imported components |
| `dataSources` | `Array<IDataSource>` | Registered data sources |
| `dataSourceOverrides` | `Array<IDataSource>` | Data source overrides |
| `disposed` | `boolean` | Whether `dispose()` has been called |

### Instance Methods

**`invalidateSchema()`** — Clears the cached schema so the next access to `.schema` rebuilds it. Call this after changing transforms or configuration at runtime.

**`dispose()`** — Tears down the component by nulling all internal references. After disposal, accessing any property throws. Check `component.disposed` before accessing a component whose lifecycle you don't control.

## Extending via Subclass

```typescript
class PropertyComponent extends GraphQLComponent {
  constructor(options) {
    super({
      types: propertyTypes,
      resolvers: propertyResolvers,
      dataSources: [new PropertyDataSource()],
      ...options
    });
  }
}
```

## Migration from v5 to v6

`delegateToComponent` was removed. Use `@graphql-tools/delegate` directly:

```typescript
import { delegateToSchema } from '@graphql-tools/delegate';

// In a resolver:
return delegateToSchema({
  schema: targetComponent.schema,
  fieldName: 'fieldName',
  args,
  context,
  info
});
```

See the [`@graphql-tools/delegate` docs](https://the-guild.dev/graphql/tools/docs/schema-delegation) for advanced delegation patterns.

## Examples

The repo includes working examples you can run locally:

```bash
npm run start-composition    # schema stitching across components
npm run start-federation     # Apollo Federation subgraph setup
```

Both start a server at `http://localhost:4000/graphql`. Source is in the [`examples/`](./examples/) directory, which also includes a [context middleware example](./examples/context-middleware/).

## License

MIT
