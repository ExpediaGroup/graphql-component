# GraphQL Component

![Build Status](https://github.com/ExpediaGroup/graphql-component/workflows/Build/badge.svg)

A library for building modular and composable GraphQL schemas through a component-based architecture.

## Overview

`graphql-component` enables you to build GraphQL schemas progressively through a tree of components. Each component encapsulates its own schema, resolvers, and data sources, making it easier to build and maintain large GraphQL APIs.

Read more about the architecture principles in our [blog post](https://medium.com/expedia-group-tech/graphql-component-architecture-principles-homeaway-ede8a58d6fde).

## Features

- 🔧 **Modular Schema Design**: Build schemas through composable components
- 🔄 **Schema Stitching**: Merge multiple component schemas seamlessly
- 🚀 **Apollo Federation Support**: Build federated subgraphs with component architecture
- 📦 **Data Source Management**: Simplified data source injection and overrides ([guide](./DATASOURCES.md))
- 🛠️ **Flexible Configuration**: Extensive options for schema customization

## Installation

```bash
npm install graphql-component
```

## Quick Start

```javascript
// CommonJS
const GraphQLComponent = require('graphql-component');

// ES Modules / TypeScript
import GraphQLComponent from 'graphql-component';

const component = new GraphQLComponent({ 
  types,
  resolvers 
});

const { schema, context } = component;
```

## Core Concepts

### Schema Construction

A `GraphQLComponent` instance creates a GraphQL schema in one of two ways:

1. **With Imports**: Creates a gateway/aggregate schema by combining imported component schemas with local types/resolvers
2. **Without Imports**: Uses `makeExecutableSchema()` to generate a schema from local types/resolvers

### Federation Support

To create Apollo Federation subgraphs, set `federation: true` in the component options:

```javascript
const component = new GraphQLComponent({
  types,
  resolvers,
  federation: true
});
```

This uses `@apollo/federation`'s `buildFederatedSchema()` instead of `makeExecutableSchema()`.

## API Reference

### GraphQLComponent Constructor

```typescript
new GraphQLComponent(options: IGraphQLComponentOptions)
```

#### Options

- `types`: `string | string[]` - GraphQL SDL type definitions
- `resolvers`: `object` - Resolver map for the schema
- `imports`: `Array<Component | ConfigObject>` - Components to import
- `context`: `{ namespace: string, factory: Function }` - Context configuration
- `mocks`: `boolean | object` - Enable default or custom mocks
- `dataSources`: `Array<DataSource>` - Data source instances
- `dataSourceOverrides`: `Array<DataSource>` - Override default data sources
- `federation`: `boolean` - Enable Apollo Federation support (default: `false`)
- `pruneSchema`: `boolean` - Enable schema pruning (default: `false`)
- `pruneSchemaOptions`: `object` - Schema pruning options
- `transforms`: `Array<SchemaMapper>` - Schema transformation functions using `@graphql-tools/utils`

### Component Instance Properties

```typescript
interface IGraphQLComponent {
  readonly name: string;
  readonly schema: GraphQLSchema;
  readonly context: IContextWrapper;
  readonly types: TypeSource;
  readonly resolvers: IResolvers<any, any>;
  readonly imports?: (IGraphQLComponent | IGraphQLComponentConfigObject)[];
  readonly dataSources?: IDataSource[];
  readonly dataSourceOverrides?: IDataSource[];
  federation?: boolean;
}
```

### Component Instance Methods

#### dispose()

Cleans up internal references and resources. Call this method when you're done with a component instance to help with garbage collection:

```typescript
component.dispose();
```

## Migration from v5.x to v6.x

### delegateToComponent Removal

In v6.0.0, `delegateToComponent` was removed. Use `@graphql-tools/delegate`'s `delegateToSchema` instead:

```javascript
// Before (v5.x - removed)
// return delegateToComponent(targetComponent, { targetRootField: 'fieldName', args, context, info });

// After (v6.x+)
import { delegateToSchema } from '@graphql-tools/delegate';

return delegateToSchema({
  schema: targetComponent.schema,
  fieldName: 'fieldName', 
  args,
  context,
  info
});
```

For more complex delegation scenarios, refer to the [`@graphql-tools/delegate` documentation](https://the-guild.dev/graphql/tools/docs/schema-delegation).

## Usage Examples

### Component Extension

```javascript
class PropertyComponent extends GraphQLComponent {
  constructor(options) {
    super({ 
      types,
      resolvers,
      ...options 
    });
  }
}
```

### Schema Aggregation

```javascript
const { schema, context } = new GraphQLComponent({
  imports: [
    new PropertyComponent(),
    new ReviewsComponent()
  ]
});

const server = new ApolloServer({ schema, context });
```

### Data Sources

Data sources in `graphql-component` provide automatic context injection and type-safe data access. The library uses a proxy system to seamlessly inject context into your data source methods.

```typescript
import GraphQLComponent, { 
  DataSourceDefinition, 
  ComponentContext,
  IDataSource
} from 'graphql-component';

// Define your data source
class UsersDataSource implements DataSourceDefinition<UsersDataSource>, IDataSource {
  name = 'users';
  
  // Context is automatically injected as first parameter
  async getUserById(context: ComponentContext, id: string) {
    // Access context for auth, config, etc.
    const token = context.auth?.token;
    return fetchUser(id, token);
  }
}

// Use in resolvers - context injection is automatic
const resolvers = {
  Query: {
    user(_, { id }, context) {
      // No need to pass context manually - it's injected automatically
      return context.dataSources.users.getUserById(id);
    }
  }
};

// Add to component
const component = new GraphQLComponent({
  types,
  resolvers,
  dataSources: [new UsersDataSource()]
});
```

**Key Concepts:**
- **Two Patterns**: Injected data sources (via context) or private data sources (via `this`)
- **Implementation**: Context must be the first parameter in injected data source methods
- **Usage**: Context is automatically injected for injected data sources
- **Resolver Binding**: Resolvers are bound to component instances, enabling `this` access
- **Testing**: Use `dataSourceOverrides` for injected sources, class extension for private sources
- **Type Safety**: TypeScript interfaces ensure correct implementation

For comprehensive documentation including both patterns, advanced usage, testing strategies, and common gotchas, see the **[Data Sources Guide](./DATASOURCES.md)**.

### Context Middleware

Components support context middleware that runs before the component's context is built. This is useful for authentication, logging, or transforming context:

```typescript
const component = new GraphQLComponent({
  types,
  resolvers
});

// Add authentication middleware
component.context.use('auth', async (context) => {
  const user = await authenticate(context.req?.headers?.authorization);
  return { ...context, user };
});

// Add logging middleware  
component.context.use('logging', async (context) => {
  console.log('Building context for request', context.requestId);
  return context;
});

// Use the context (middleware runs automatically)
const context = await component.context({ req, requestId: '123' });
// Context now includes user and logs the request
```

Middleware runs in the order it's added and each middleware receives the transformed context from the previous middleware.

## Examples

The repository includes working example implementations demonstrating different use cases:

### Local Schema Composition
```bash
npm run start-composition
```
This example shows how to compose multiple GraphQL components into a single schema using schema stitching.

### Federation Example
```bash
npm run start-federation
```
This example demonstrates building Apollo Federation subgraphs using GraphQL components.

Both examples are accessible at `http://localhost:4000/graphql` when running.

You can find the complete example code in the [`examples/`](./examples/) directory.

## Debugging

Enable debug logging with:
```bash
DEBUG=graphql-component:* node your-app.js
```

## Repository Structure

- `src/` - Core library code
- `examples/`
  - `composition/` - Schema composition example
  - `federation/` - Federation implementation example

## Contributing

Please read our contributing guidelines (link) for details on our code of conduct and development process.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
