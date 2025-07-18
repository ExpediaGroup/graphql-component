# Data Sources Guide

Data sources in `graphql-component` provide a sophisticated system for managing data access with automatic context injection, type safety, and testing capabilities. This guide covers all aspects of implementing, using, and testing data sources.

## Table of Contents

- [Core Concepts](#core-concepts)
- [Implementation](#implementation)
- [TypeScript Integration](#typescript-integration)
- [Context System](#context-system)
- [Testing](#testing)
- [Advanced Patterns](#advanced-patterns)
- [Common Gotchas](#common-gotchas)
- [Migration Guide](#migration-guide)

## Core Concepts

### Proxy-Based Context Injection

`graphql-component` uses a proxy system to automatically inject context into data source methods. This means:

1. **When implementing** data sources: context is the first parameter
2. **When using** data sources in resolvers: context is automatically injected

```typescript
// Implementation - context is required as first parameter
class UserDataSource implements DataSourceDefinition<UserDataSource> {
  name = 'users';
  
  async getUser(context: ComponentContext, id: string) {
    // Access context for auth, config, etc.
    const token = context.auth?.token;
    return fetchUser(id, token);
  }
}

// Usage in resolvers - context is automatically injected
const resolvers = {
  Query: {
    user(_, { id }, context) {
      // ✅ Correct - context injected automatically
      return context.dataSources.users.getUser(id);
      
      // ❌ Wrong - don't pass context manually
      // return context.dataSources.users.getUser(context, id);
    }
  }
};
```

### Dual Type System

The library provides two complementary TypeScript types:

- **`DataSourceDefinition<T>`**: For implementing data sources (requires context parameter)
- **`DataSource<T>`**: For consuming data sources (context automatically injected)

This ensures type safety while providing a clean API for both implementation and usage.

## Data Access Patterns

There are two distinct patterns for accessing data in `graphql-component`, each with different characteristics and use cases:

### 1. Injected Data Sources (Recommended)

This is the primary pattern where data sources are passed via constructor options and accessed through the context object. This pattern provides automatic context injection, testing overrides, and clean separation of concerns.

### 2. Private Data Sources (Alternative)

Data sources can also be created as private properties of the component class and accessed via `this` in resolvers. Since resolvers are automatically bound to the component instance, `this` refers to the component.

## Pattern Comparison

| Feature | Injected Data Sources | Private Data Sources |
|---------|----------------------|---------------------|
| **Access Method** | `context.dataSources.name` | `this.dataSourceName` |
| **Context Injection** | ✅ Automatic proxy injection | ❌ Manual context passing required |
| **Testing Overrides** | ✅ Via `dataSourceOverrides` | ❌ No built-in override mechanism |
| **Configuration Overrides** | ✅ Runtime data source swapping | ❌ Hardcoded at instantiation |
| **Dependency Injection** | ✅ Constructor injection | ❌ Direct instantiation |
| **Environment Flexibility** | ✅ Easy dev/test/prod variants | ❌ Requires code changes |
| **Type Safety** | ✅ Full TypeScript support | ✅ Standard TypeScript |
| **Resolver Binding** | N/A | ✅ Automatic `this` binding |
| **Use Case** | Data access, external APIs | Component delegation, internal logic |

## Implementation

### Pattern 1: Injected Data Sources

```typescript
import { DataSourceDefinition, ComponentContext, IDataSource } from 'graphql-component';

interface User {
  id: string;
  name: string;
  email: string;
}

class UserDataSource implements DataSourceDefinition<UserDataSource>, IDataSource {
  name = 'users'; // Required for identification
  
  // Static properties are preserved
  private apiUrl = 'https://api.example.com';
  
  async getUser(context: ComponentContext, id: string): Promise<User | null> {
    // Access context properties
    const { auth, config } = context;
    
    const response = await fetch(`${this.apiUrl}/users/${id}`, {
      headers: {
        'Authorization': `Bearer ${auth?.token}`,
        'X-Request-ID': context.requestId
      }
    });
    
    if (!response.ok) {
      return null;
    }
    
    return response.json();
  }
  
  async getUsersByRole(context: ComponentContext, role: string): Promise<User[]> {
    // Implementation details...
    return [];
  }
  
  // Non-function properties are preserved by the proxy
  get baseUrl() {
    return this.apiUrl;
  }
}

export default UserDataSource;
```

### Pattern 2: Private Data Sources

In this pattern, data sources are created as component properties and accessed via `this` in resolvers. Resolvers are automatically bound to the component instance.

```typescript
import GraphQLComponent from 'graphql-component';

class UserDataSource {
  name = 'users';
  private apiUrl = 'https://api.example.com';
  
  // Note: No ComponentContext parameter - manual context passing required
  async getUser(id: string, context?: any) {
    const token = context?.auth?.token;
    
    const response = await fetch(`${this.apiUrl}/users/${id}`, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    });
    
    return response.json();
  }
}

class UserComponent extends GraphQLComponent {
  private userDataSource: UserDataSource;
  
  constructor(options = {}) {
    super({
      types: `
        type User { id: ID!, name: String! }
        type Query { user(id: ID!): User }
      `,
      resolvers: {
        Query: {
          // 'this' is automatically bound to the component instance
          user(_, { id }, context) {
            // Access private data source via 'this'
            return this.userDataSource.getUser(id, context);
          }
        }
      },
      ...options
    });
    
    // Create data source as private property
    this.userDataSource = new UserDataSource();
  }
}

export default UserComponent;
```

### Pattern 2 Limitations

**Important**: Private data sources sacrifice flexibility for direct control. Key limitations include:

#### No Configuration-Based Overrides
```typescript
// ❌ This won't work with private data sources
const component = new UserComponent({
  dataSourceOverrides: [new MockUserDataSource()] // Only works with injected pattern
});

// ❌ Private data sources are hardcoded
class UserComponent extends GraphQLComponent {
  constructor(options = {}) {
    // Data source is created here and can't be overridden via options
    this.userDataSource = new UserDataSource();
  }
}
```

#### No Environment-Based Swapping
```typescript
// ✅ Easy with injected pattern
const dataSources = process.env.NODE_ENV === 'test' 
  ? [new MockUserDataSource()]
  : [new ProdUserDataSource()];

const component = new GraphQLComponent({
  dataSources,
  // ...
});

// ❌ Harder with private pattern - requires conditional logic in constructor
class UserComponent extends GraphQLComponent {
  constructor(options = {}) {
    super(options);
    
    // Must handle environment logic manually
    this.userDataSource = process.env.NODE_ENV === 'test'
      ? new MockUserDataSource()
      : new ProdUserDataSource();
  }
}
```

#### Limited Testing Flexibility
```typescript
// ✅ Injected pattern - easy testing
test('with injected data sources', async (t) => {
  const component = new GraphQLComponent({
    types,
    resolvers,
    dataSourceOverrides: [new MockDataSource()] // Simple override
  });
});

// ❌ Private pattern - requires class extension or dependency injection design
test('with private data sources', async (t) => {
  // Must extend the class or redesign for injection
  class TestComponent extends UserComponent {
    constructor() {
      super();
      this.userDataSource = new MockDataSource(); // Override after construction
    }
  }
  
  const component = new TestComponent();
});
```

#### No Runtime Reconfiguration
```typescript
// ✅ Injected pattern supports runtime changes
const component = new GraphQLComponent({
  dataSources: [new UserDataSource()]
});

// Later, create new instance with different data sources
const testComponent = new GraphQLComponent({
  imports: [component],
  dataSourceOverrides: [new TestDataSource()]
});

// ❌ Private pattern is fixed at construction time
class UserComponent extends GraphQLComponent {
  constructor() {
    // Once set, this.userDataSource cannot be changed via configuration
    this.userDataSource = new UserDataSource();
  }
}
```

**When to Accept These Limitations**: Use private data sources when you need direct control and these limitations are acceptable, such as:
- Component delegation (accessing other component schemas)
- Component-specific configuration that doesn't need to change
- Internal component logic that shouldn't be externally configurable

### Pattern 2 Use Cases

Private data sources are particularly useful for:

**Component Delegation**: Accessing other component schemas for cross-component calls:

```typescript
import PropertyComponent from './property-component';
import ReviewsComponent from './reviews-component';

class ListingComponent extends GraphQLComponent {
  propertyComponent: PropertyComponent;
  reviewsComponent: ReviewsComponent;
  
  constructor(options = {}) {
    const propertyComponent = new PropertyComponent();
    const reviewsComponent = new ReviewsComponent();

    super({
      types: `
        type Listing {
          id: ID!
          property: Property
          reviews: [Review]
        }
      `,
      resolvers: {
        Listing: {
          // Use 'this' to access component references
          property(root, args, context, info) {
            return delegateToSchema({
              schema: this.propertyComponent.schema,
              fieldName: 'propertyById',
              args: { id: root.id },
              context,
              info
            });
          },
          
          reviews(root, args, context, info) {
            return delegateToSchema({
              schema: this.reviewsComponent.schema,
              fieldName: 'reviewsByPropertyId',
              args: { propertyId: root.id },
              context,
              info
            });
          }
        }
      },
      imports: [propertyComponent, reviewsComponent],
      ...options
    });

    // Store component references for delegation
    this.propertyComponent = propertyComponent;
    this.reviewsComponent = reviewsComponent;
  }
}
```

**Component State**: Storing component-specific configuration or state:

```typescript
class UserComponent extends GraphQLComponent {
  private config: { timeout: number; retries: number };
  
  constructor({ timeout = 5000, retries = 3, ...options } = {}) {
    super({
      resolvers: {
        Query: {
          user(_, { id }, context) {
            // Access component configuration via 'this'
            return this.fetchUserWithConfig(id, context);
          }
        }
      },
      ...options
    });
    
    this.config = { timeout, retries };
  }
  
  private async fetchUserWithConfig(id: string, context: any) {
    // Use component-specific configuration
    const { timeout, retries } = this.config;
    // Implementation with timeout and retry logic
  }
}
```

### Advanced Implementation with Interfaces

For complex data sources, define explicit interfaces:

```typescript
interface UserDataSourceInterface {
  getUser: (context: ComponentContext, id: string) => Promise<User | null>;
  getUsersByRole: (context: ComponentContext, role: string) => Promise<User[]>;
  getUsersByTeam: (context: ComponentContext, teamId: string) => Promise<User[]>;
  cacheTimeout: number;
}

class UserDataSource implements DataSourceDefinition<UserDataSourceInterface>, IDataSource {
  name = 'users';
  cacheTimeout = 300; // 5 minutes
  
  async getUser(context: ComponentContext, id: string): Promise<User | null> {
    // Implementation
  }
  
  async getUsersByRole(context: ComponentContext, role: string): Promise<User[]> {
    // Implementation
  }
  
  async getUsersByTeam(context: ComponentContext, teamId: string): Promise<User[]> {
    // Implementation
  }
}
```

## TypeScript Integration

### Type Safety in Components

```typescript
import GraphQLComponent from 'graphql-component';
import UserDataSource from './datasource';

export default class UserComponent extends GraphQLComponent {
  constructor({ dataSources = [new UserDataSource()], ...options } = {}) {
    super({
      types,
      resolvers,
      dataSources,
      ...options
    });
  }
}
```

### Type Safety in Resolvers

```typescript
import { ComponentContext } from 'graphql-component';

const resolvers = {
  Query: {
    // Destructure dataSources with types
    user(_: any, { id }: { id: string }, { dataSources }: ComponentContext) {
      return dataSources.users.getUser(id);
    },
    
    // Or use full context with explicit typing
    usersByRole(_: any, { role }: { role: string }, context: ComponentContext) {
      return context.dataSources.users.getUsersByRole(role);
    }
  },
  
  User: {
    // Access other data sources from the same context
    team(user: User, _: any, { dataSources }: ComponentContext) {
      return dataSources.teams.getTeam(user.teamId);
    }
  }
};
```

### Advanced TypeScript Patterns

For complex applications, you can extend the `ComponentContext` interface:

```typescript
// types/context.ts
declare module 'graphql-component' {
  interface ComponentContext {
    auth: {
      token: string;
      userId: string;
      roles: string[];
    };
    requestId: string;
    config: {
      apiUrl: string;
      timeout: number;
    };
  }
}
```

## Context System

### Context Structure

The context passed to data sources includes:

```typescript
interface ComponentContext {
  dataSources: DataSourceMap;
  // Additional context from middleware and component configuration
  [key: string]: unknown;
}
```

**Important**: The context injected into data source methods does **NOT** include the `dataSources` property. This is an intentional design decision to prevent data sources from calling other data sources directly.

```typescript
class UserDataSource implements DataSourceDefinition<UserDataSource> {
  name = 'users';
  
  async getUser(context: ComponentContext, id: string) {
    // ✅ Available: auth, config, request data, etc.
    const token = context.auth?.token;
    const requestId = context.requestId;
    
    // ❌ NOT available: context.dataSources is undefined here
    // This prevents: context.dataSources.teams.getTeam(user.teamId)
    
    return fetchUser(id, token);
  }
}
```

This architectural constraint serves several important purposes:

1. **Prevents Tight Coupling**: Data sources remain independent and reusable
2. **Avoids Circular Dependencies**: Eliminates risk of data sources calling each other in loops  
3. **Separation of Concerns**: Data fetching stays in data sources, composition happens in resolvers
4. **Better Testing**: Each data source can be tested in isolation
5. **Clearer Architecture**: Forces explicit data composition patterns in resolvers

### Accessing Context Data

```typescript
class UserDataSource implements DataSourceDefinition<UserDataSource> {
  name = 'users';
  
  async getUser(context: ComponentContext, id: string) {
    // Access authentication
    const token = context.auth?.token;
    
    // Access request metadata
    const requestId = context.requestId;
    
    // Access configuration
    const timeout = context.config?.timeout || 5000;
    
    // Access other context data
    const customData = context.customNamespace?.data;
    
    return fetchUserWithAuth(id, token, { requestId, timeout });
  }
}
```

### Data Composition Patterns

Since data sources cannot call other data sources, data composition must happen in resolvers. This leads to cleaner, more maintainable code:

```typescript
// ✅ Correct: Compose data in resolvers
const resolvers = {
  User: {
    // Fetch user's team information
    async team(user, _, { dataSources }) {
      return dataSources.teams.getTeam(user.teamId);
    },
    
    // Fetch user's recent activities
    async recentActivities(user, _, { dataSources }) {
      return dataSources.activities.getActivitiesByUser(user.id);
    }
  },
  
  Query: {
    // Compose user with related data
    async userWithDetails(_, { id }, { dataSources }) {
      const user = await dataSources.users.getUser(id);
      if (!user) return null;
      
      // GraphQL will automatically resolve the team and recentActivities fields
      // using the resolvers above when requested
      return user;
    }
  }
};

// ❌ Wrong: Don't try to compose in data sources
class UserDataSource implements DataSourceDefinition<UserDataSource> {
  name = 'users';
  
  async getUserWithTeam(context: ComponentContext, id: string) {
    const user = await this.getUser(context, id);
    
    // This won't work - context.dataSources is undefined
    // const team = await context.dataSources.teams.getTeam(user.teamId);
    
    return user;
  }
}
```

This pattern provides several benefits:

- **Flexible Queries**: Clients can request only the data they need
- **Parallel Execution**: GraphQL can fetch related data in parallel when possible
- **Cacheable**: Each data source method can be cached independently
- **Testable**: Each resolver and data source can be tested in isolation
- **Reusable**: Data sources remain focused and reusable across different contexts

### Context Middleware

Data sources work seamlessly with context middleware:

```typescript
const component = new GraphQLComponent({
  types,
  resolvers,
  dataSources: [new UserDataSource()]
});

// Add authentication middleware
component.context.use('auth', async (context) => {
  const token = extractTokenFromRequest(context.req);
  const user = await validateToken(token);
  
  return {
    ...context,
    auth: {
      token,
      userId: user.id,
      roles: user.roles
    }
  };
});

// Add request tracking
component.context.use('tracking', async (context) => {
  return {
    ...context,
    requestId: generateRequestId()
  };
});
```

## Testing

### Basic Data Source Testing

```typescript
import test from 'tape';
import GraphQLComponent from 'graphql-component';
import UserDataSource from '../src/datasource';

test('UserDataSource', (t) => {
  t.test('should inject context correctly', async (assert) => {
    const component = new GraphQLComponent({
      types: `type Query { test: String }`,
      dataSources: [new UserDataSource()]
    });

    const context = await component.context({
      auth: { token: 'test-token' },
      requestId: 'test-123'
    });

    // Context is automatically injected
    const user = await context.dataSources.users.getUser('user-1');
    
    assert.ok(user, 'user was retrieved');
    assert.end();
  });
});
```

### Mock Data Sources for Testing

```typescript
class MockUserDataSource implements DataSourceDefinition<UserDataSource>, IDataSource {
  name = 'users';
  
  private mockUsers = new Map([
    ['1', { id: '1', name: 'John Doe', email: 'john@example.com' }],
    ['2', { id: '2', name: 'Jane Smith', email: 'jane@example.com' }]
  ]);
  
  async getUser(context: ComponentContext, id: string) {
    // Mock implementation with context access
    console.log(`Mock: Getting user ${id} for request ${context.requestId}`);
    return this.mockUsers.get(id) || null;
  }
  
  async getUsersByRole(context: ComponentContext, role: string) {
    // Return filtered mock data
    return Array.from(this.mockUsers.values())
      .filter(user => user.role === role);
  }
}

// Use in tests
test('component with mock data source', async (t) => {
  const component = new GraphQLComponent({
    types,
    resolvers,
    dataSourceOverrides: [new MockUserDataSource()] // Override real data source
  });

  const context = await component.context({ requestId: 'test-123' });
  const user = await context.dataSources.users.getUser('1');
  
  t.equal(user.name, 'John Doe', 'mock data source returned expected user');
  t.end();
});
```

### Testing Private Data Sources

**Important**: Private data sources **cannot** use `dataSourceOverrides` for testing. This is a key limitation that requires alternative testing strategies:

```typescript
test('private data source testing', async (t) => {
  t.test('test by extending component class', async (assert) => {
    class MockUserDataSource {
      name = 'users';
      async getUser(id: string, context?: any) {
        return { id, name: 'Mock User', email: 'mock@example.com' };
      }
    }

    // Create test component by extending original
    class TestUserComponent extends UserComponent {
      constructor(options = {}) {
        super(options);
        // Override the private data source
        this.userDataSource = new MockUserDataSource();
      }
    }

    const component = new TestUserComponent();
    const context = await component.context({});
    
    // Test via GraphQL execution
    const result = await graphql({
      schema: component.schema,
      source: '{ user(id: "1") { name } }',
      contextValue: context
    });

    assert.equal(result.data?.user.name, 'Mock User', 'private data source was mocked');
    assert.end();
  });

  t.test('test by dependency injection', async (assert) => {
    // Design component to accept data source via constructor
    class ConfigurableUserComponent extends GraphQLComponent {
      private userDataSource: any;
      
      constructor({ userDataSource = new UserDataSource(), ...options } = {}) {
        super({
          resolvers: {
            Query: {
              user(_, { id }, context) {
                return this.userDataSource.getUser(id, context);
              }
            }
          },
          ...options
        });
        
        this.userDataSource = userDataSource;
      }
    }

    // Inject mock data source
    const mockDataSource = {
      name: 'users',
      async getUser(id: string) {
        return { id, name: 'Injected Mock User' };
      }
    };

    const component = new ConfigurableUserComponent({
      userDataSource: mockDataSource
    });

    const context = await component.context({});
    const result = await graphql({
      schema: component.schema,
      source: '{ user(id: "1") { name } }',
      contextValue: context
    });

    assert.equal(result.data?.user.name, 'Injected Mock User', 'injected mock data source works');
    assert.end();
  });
});
```

### Testing with Component Imports

```typescript
test('data source overrides with imports', async (t) => {
  const userComponent = new UserComponent();
  
  const testComponent = new GraphQLComponent({
    imports: [userComponent],
    dataSourceOverrides: [new MockUserDataSource()]
  });

  const context = await testComponent.context({});
  
  // Even though UserComponent has its own UserDataSource,
  // the override replaces it
  const user = await context.dataSources.users.getUser('1');
  t.equal(user.name, 'John Doe', 'override replaced original data source');
  t.end();
});
```

### Integration Testing with GraphQL

```typescript
import { graphql } from 'graphql';

test('full integration with resolvers', async (t) => {
  const component = new GraphQLComponent({
    types: `
      type User {
        id: ID!
        name: String!
        email: String!
      }
      type Query {
        user(id: ID!): User
      }
    `,
    resolvers: {
      Query: {
        user(_, { id }, { dataSources }) {
          return dataSources.users.getUser(id);
        }
      }
    },
    dataSourceOverrides: [new MockUserDataSource()]
  });

  const context = await component.context({ requestId: 'test-456' });
  
  const result = await graphql({
    schema: component.schema,
    source: `
      query {
        user(id: "1") {
          id
          name
          email
        }
      }
    `,
    contextValue: context
  });

  t.ok(result.data?.user, 'user query returned data');
  t.equal(result.data.user.name, 'John Doe', 'correct user data returned');
  t.end();
});
```

## Advanced Patterns

### Caching Data Sources

```typescript
class CachedUserDataSource implements DataSourceDefinition<CachedUserDataSource> {
  name = 'users';
  private cache = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  async getUser(context: ComponentContext, id: string) {
    const cacheKey = `user:${id}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    const user = await this.fetchUser(context, id);
    
    this.cache.set(cacheKey, {
      data: user,
      timestamp: Date.now()
    });

    return user;
  }

  private async fetchUser(context: ComponentContext, id: string) {
    // Actual data fetching logic
    return { id, name: `User ${id}` };
  }
}
```

### Batch Loading

```typescript
import DataLoader from 'dataloader';

class BatchUserDataSource implements DataSourceDefinition<BatchUserDataSource> {
  name = 'users';
  private loader: DataLoader<string, User>;

  constructor() {
    this.loader = new DataLoader(async (ids: readonly string[]) => {
      // Batch fetch all users
      const users = await this.batchFetchUsers([...ids]);
      
      // Return in same order as input
      return ids.map(id => users.find(user => user.id === id) || null);
    });
  }

  async getUser(context: ComponentContext, id: string) {
    // Use DataLoader for automatic batching
    return this.loader.load(id);
  }

  private async batchFetchUsers(ids: string[]): Promise<User[]> {
    // Implement batch fetching logic
    return [];
  }
}
```

### Environment-Specific Data Sources

```typescript
// Production data source
class ProdUserDataSource implements DataSourceDefinition<UserDataSource> {
  name = 'users';
  
  async getUser(context: ComponentContext, id: string) {
    // Real API call
    return fetch(`/api/users/${id}`).then(r => r.json());
  }
}

// Development data source
class DevUserDataSource implements DataSourceDefinition<UserDataSource> {
  name = 'users';
  
  async getUser(context: ComponentContext, id: string) {
    // Mock data for development
    return { id, name: `Dev User ${id}`, email: `user${id}@dev.local` };
  }
}

// Component with environment-specific defaults
export default class UserComponent extends GraphQLComponent {
  constructor(options = {}) {
    const defaultDataSource = process.env.NODE_ENV === 'production' 
      ? new ProdUserDataSource()
      : new DevUserDataSource();
      
    super({
      types,
      resolvers,
      dataSources: [defaultDataSource],
      ...options
    });
  }
}
```

## Common Gotchas

### ❌ Trying to Access Other Data Sources

```typescript
// Wrong - context.dataSources is undefined in data source methods
class UserDataSource implements DataSourceDefinition<UserDataSource> {
  name = 'users';
  
  async getUserWithTeam(context: ComponentContext, id: string) {
    const user = await this.getUser(context, id);
    
    // ❌ This will throw an error - dataSources is not available
    const team = await context.dataSources.teams.getTeam(user.teamId);
    
    return { ...user, team };
  }
}

// Correct - compose data in resolvers
const resolvers = {
  User: {
    async team(user, _, { dataSources }) {
      // ✅ dataSources is available in resolvers
      return dataSources.teams.getTeam(user.teamId);
    }
  }
};
```

**Why this restriction exists**: Prevents tight coupling, circular dependencies, and maintains clean separation of concerns.

### ❌ Passing Context Manually

```typescript
// Wrong - context is injected automatically
const resolvers = {
  Query: {
    user(_, { id }, context) {
      return context.dataSources.users.getUser(context, id); // ❌ Don't do this
    }
  }
};

// Correct - context injection is automatic
const resolvers = {
  Query: {
    user(_, { id }, context) {
      return context.dataSources.users.getUser(id); // ✅ Correct
    }
  }
};
```

### ❌ Incorrect Interface Implementation

```typescript
// Wrong - missing context parameter
class UserDataSource implements DataSourceDefinition<UserDataSource> {
  name = 'users';
  
  async getUser(id: string) { // ❌ Missing context parameter
    return { id };
  }
}

// Correct - context as first parameter
class UserDataSource implements DataSourceDefinition<UserDataSource> {
  name = 'users';
  
  async getUser(context: ComponentContext, id: string) { // ✅ Context first
    return { id };
  }
}
```

### ❌ Missing Name Property

```typescript
// Wrong - no name property
class UserDataSource implements DataSourceDefinition<UserDataSource> {
  async getUser(context: ComponentContext, id: string) {
    return { id };
  }
}

// Correct - include name property
class UserDataSource implements DataSourceDefinition<UserDataSource> {
  name = 'users'; // ✅ Required for identification
  
  async getUser(context: ComponentContext, id: string) {
    return { id };
  }
}
```

### ❌ Binding Issues with Arrow Functions

```typescript
// Potentially problematic - arrow functions don't bind properly
class UserDataSource implements DataSourceDefinition<UserDataSource> {
  name = 'users';
  private apiUrl = 'https://api.example.com';
  
  getUser = async (context: ComponentContext, id: string) => {
    // This might not have correct 'this' binding in some cases
    return fetch(`${this.apiUrl}/users/${id}`);
  }
}

// Preferred - regular methods
class UserDataSource implements DataSourceDefinition<UserDataSource> {
  name = 'users';
  private apiUrl = 'https://api.example.com';
  
  async getUser(context: ComponentContext, id: string) {
    // Correct 'this' binding guaranteed
    return fetch(`${this.apiUrl}/users/${id}`);
  }
}
```

### ❌ Forgetting Resolver Binding Context

```typescript
// Wrong - 'this' won't work in arrow function resolvers with private data sources
const resolvers = {
  Query: {
    user: (_, { id }, context) => {
      // ❌ 'this' is undefined in arrow functions
      return this.userDataSource.getUser(id, context);
    }
  }
};

// Correct - use regular function for 'this' binding
const resolvers = {
  Query: {
    user(_, { id }, context) {
      // ✅ 'this' correctly bound to component instance
      return this.userDataSource.getUser(id, context);
    }
  }
};
```

### ❌ Mixed Pattern Confusion

```typescript
// Wrong - mixing patterns without understanding
class UserComponent extends GraphQLComponent {
  private userDataSource: UserDataSource;
  
  constructor(options = {}) {
    super({
      resolvers: {
        Query: {
          user(_, { id }, context) {
            // ❌ Trying to use injected pattern with private data source
            return context.dataSources.users.getUser(id);
            
            // ✅ Should be using private pattern
            // return this.userDataSource.getUser(id, context);
          }
        }
      },
      dataSources: [new UserDataSource()], // ❌ Redundant if using private pattern
      ...options
    });
    
    this.userDataSource = new UserDataSource(); // ❌ Now have two instances
  }
}
```

### ❌ Expecting dataSourceOverrides to Work with Private Data Sources

```typescript
// Wrong - dataSourceOverrides only works with injected pattern
class UserComponent extends GraphQLComponent {
  private userDataSource: UserDataSource;
  
  constructor(options = {}) {
    super(options);
    this.userDataSource = new UserDataSource();
  }
}

// ❌ This will NOT override the private data source
const component = new UserComponent({
  dataSourceOverrides: [new MockUserDataSource()] // This only affects injected data sources
});

// ✅ Correct - design for dependency injection if you need overrides
class UserComponent extends GraphQLComponent {
  private userDataSource: UserDataSource;
  
  constructor({ userDataSource = new UserDataSource(), ...options } = {}) {
    super(options);
    this.userDataSource = userDataSource; // Accept via constructor
  }
}

const component = new UserComponent({
  userDataSource: new MockUserDataSource() // Now this works
});

// Correct - choose one pattern consistently
class UserComponent extends GraphQLComponent {
  private userDataSource: UserDataSource;
  
  constructor(options = {}) {
    super({
      resolvers: {
        Query: {
          user(_, { id }, context) {
            // ✅ Using private pattern consistently
            return this.userDataSource.getUser(id, context);
          }
        }
      },
      // ✅ No dataSources array when using private pattern
      ...options
    });
    
    this.userDataSource = new UserDataSource();
  }
}
```

## Migration Guide

### From v5.x to v6.x

The data source system is largely unchanged between versions, but here are the key differences:

#### Import Changes
```typescript
// v5.x
const GraphQLComponent = require('graphql-component');

// v6.x - TypeScript with proper imports
import GraphQLComponent, { 
  DataSourceDefinition, 
  ComponentContext,
  IDataSource 
} from 'graphql-component';
```

#### Enhanced Type Safety
v6.x provides better TypeScript support:

```typescript
// v6.x - More explicit typing
class UserDataSource implements DataSourceDefinition<UserDataSource>, IDataSource {
  name = 'users';
  
  async getUser(context: ComponentContext, id: string): Promise<User | null> {
    // Better type inference and checking
    return null;
  }
}
```

### Best Practices Summary

#### General Principles
1. **Data sources don't call data sources**: Compose data in resolvers, not data sources
2. **Choose one pattern consistently**: Don't mix injected and private patterns in the same component
3. **Prefer regular methods**: Over arrow functions for better `this` binding
4. **Type your interfaces**: Define explicit interfaces for complex data sources
5. **Cache when appropriate**: Implement caching for expensive operations
6. **Handle errors gracefully**: Return null/undefined for missing data rather than throwing

#### Injected Data Sources (Recommended)
7. **Always implement both interfaces**: `DataSourceDefinition<T>` and `IDataSource`
8. **Context first**: Always make context the first parameter in data source methods
9. **Don't pass context manually**: Let the proxy handle context injection
10. **Use meaningful names**: The `name` property is used for identification
11. **Test with overrides**: Use `dataSourceOverrides` for testing

#### Private Data Sources
12. **Use regular functions in resolvers**: Arrow functions break `this` binding
13. **Design for testability**: Accept data sources via constructor or create extension points
14. **Manual context passing**: Remember to pass context manually to private data source methods
15. **Use for delegation**: Ideal for accessing other component schemas

#### When to Use Which Pattern

**Use Injected Data Sources When:**
- ✅ Accessing external APIs or databases
- ✅ You need testing overrides (`dataSourceOverrides`)
- ✅ Different environments require different implementations
- ✅ Data sources might be shared across components
- ✅ You want runtime configuration flexibility
- ✅ Following dependency injection principles

**Use Private Data Sources When:**
- ✅ Component delegation (accessing other component schemas)
- ✅ Component-specific internal logic that shouldn't be configurable
- ✅ You need direct control and accept the configuration limitations
- ✅ The data source is tightly coupled to the component implementation
- ❌ **Avoid if** you need testing overrides via configuration
- ❌ **Avoid if** you need environment-based data source swapping
- ❌ **Avoid if** you need runtime reconfiguration

The data source system is one of the most powerful features of `graphql-component`, providing automatic context injection, type safety, and flexible testing capabilities. Understanding these patterns will help you build robust, maintainable GraphQL APIs. 