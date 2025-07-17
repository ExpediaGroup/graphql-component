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
- 📦 **Data Source Management**: Simplified data source injection and overrides
- 🛠️ **Flexible Configuration**: Extensive options for schema customization

## Installation

```bash
npm install graphql-component
```

## Quick Start

```javascript
const GraphQLComponent = require('graphql-component');

const { schema, context } = new GraphQLComponent({ 
  types,
  resolvers 
});
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

This uses `@apollo/federation`'s `buildSubgraphSchema()` instead of `makeExecutableSchema()`.

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
- `transforms`: `Array<Transform>` - Schema transformation functions

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

Data sources in `graphql-component` use a proxy-based approach for context injection. The library provides two key types to assist with correct implementation:

```typescript
// When implementing a data source:
class MyDataSource implements DataSourceDefinition<MyDataSource> {
  name = 'MyDataSource';
  
  // Context must be the first parameter when implementing
  async getUserById(context: ComponentContext, id: string) {
    // Use context for auth, config, etc.
    return { id, name: 'User Name' };
  }
}

// In resolvers, context is automatically injected:
const resolvers = {
  Query: {
    user(_, { id }, context) {
      // Don't need to pass context - it's injected automatically
      return context.dataSources.MyDataSource.getUserById(id);
    }
  }
}

// Add to component:
new GraphQLComponent({
  types,
  resolvers,
  dataSources: [new MyDataSource()]
});
```

#### Data Source Types

- `DataSourceDefinition<T>`: Interface for implementing data sources - methods must accept context as first parameter
- `DataSource<T>`: Type representing data sources after proxy wrapping - context is automatically injected

This type system ensures proper context handling while providing a clean API for resolver usage.

#### TypeScript Example

```typescript
import { 
  GraphQLComponent, 
  DataSourceDefinition, 
  ComponentContext 
} from 'graphql-component';

// Define your data source with proper types
class UsersDataSource implements DataSourceDefinition<UsersDataSource> {
  name = 'users';
  
  // Static property
  defaultRole = 'user';
  
  // Context is required as first parameter when implementing
  async getUserById(context: ComponentContext, id: string): Promise<User> {
    // Access context properties (auth, etc.)
    const apiKey = context.config?.apiKey;
    
    // Implementation details...
    return { id, name: 'User Name', role: this.defaultRole };
  }
  
  async getUsersByRole(context: ComponentContext, role: string): Promise<User[]> {
    // Implementation details...
    return [
      { id: '1', name: 'User 1', role },
      { id: '2', name: 'User 2', role }
    ];
  }
}

// In resolvers, the context is automatically injected
const resolvers = {
  Query: {
    user: (_, { id }, context) => {
      // No need to pass context - it's injected by the proxy
      return context.dataSources.users.getUserById(id);
    },
    usersByRole: (_, { role }, context) => {
      // No need to pass context - it's injected by the proxy
      return context.dataSources.users.getUsersByRole(role);
    }
  }
};

// Component configuration
const usersComponent = new GraphQLComponent({
  types: `
    type User {
      id: ID!
      name: String!
      role: String!
    }
    
    type Query {
      user(id: ID!): User
      usersByRole(role: String!): [User]
    }
  `,
  resolvers,
  dataSources: [new UsersDataSource()]
});
```

#### Data Source Overrides

You can override data sources when needed (for testing or extending functionality). The override must follow the same interface:

```typescript
// For testing - create a mock data source
class MockUsersDataSource implements DataSourceDefinition<UsersDataSource> {
  name = 'users';
  defaultRole = 'admin';
  
  async getUserById(context: ComponentContext, id: string) {
    return { id, name: 'Mock User', role: this.defaultRole };
  }
  
  async getUsersByRole(context: ComponentContext, role: string) {
    return [{ id: 'mock', name: 'Mock User', role }];
  }
}

// Use the component with overrides
const testComponent = new GraphQLComponent({
  imports: [usersComponent],
  dataSourceOverrides: [new MockUsersDataSource()]
});

// In tests
const context = await testComponent.context({});
const mockUser = await context.dataSources.users.getUserById('any-id');
// mockUser will be { id: 'any-id', name: 'Mock User', role: 'admin' }
```

## Examples

The repository includes example implementations:

### Local Schema Composition
```bash
npm run start-composition
```

### Federation Example
```bash
npm run start-federation
```

Both examples are accessible at `http://localhost:4000/graphql`

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
