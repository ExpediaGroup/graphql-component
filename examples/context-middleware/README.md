# Context & Middleware Example

This example demonstrates the powerful context and middleware system in `graphql-component`. It shows how to implement authentication, logging, request tracking, and namespace contexts using the `context.use()` middleware chain.

## What You'll Learn

- **Middleware Chaining**: How to chain multiple middleware functions using `context.use()`
- **Authentication Patterns**: JWT validation, role-based authorization, and auth helpers
- **Request Tracking**: Capturing request metadata and generating unique request IDs
- **Namespace Contexts**: Organizing context data using component namespaces
- **Logging Integration**: Structured logging with request correlation
- **Security Patterns**: Protecting resolvers with authentication and authorization
- **Data Source Integration**: How middleware can access data sources for authentication and other operations

## Architecture Overview

The example consists of several components working together:

```
┌─────────────────────┐
│   Apollo Server     │
└─────────┬───────────┘
          │
┌─────────▼───────────┐
│   Main Component    │ ← Imports all sub-components
├─────────────────────┤
│ • Auth Component    │ ← JWT auth, user management
│ • Logging Component │ ← Request/response logging
│ • Namespace Context │ ← User prefs, business data
└─────────┬───────────┘
          │
┌─────────▼───────────┐
│ Middleware Chain    │
├─────────────────────┤
│ 1. Request Tracking │ ← Generate request ID, capture metadata
│ 2. Authentication   │ ← Validate JWT, set user context
│ 3. Business Context │ ← Tenant info, feature flags
│ 4. Analytics        │ ← Session tracking, user analytics
│ 5. Logging          │ ← Log request start, errors
└─────────────────────┘
```

## Components

### 1. Auth Component (`/auth-component/`)

Handles user authentication and authorization:

- **JWT Token Management**: Login, validation, expiration
- **User Storage**: Mock user database with roles
- **Authorization Helpers**: `requireAuth()`, `requireRole()`, `hasRole()`
- **Protected Resolvers**: Queries that require authentication or specific roles

**Key Files:**
- `datasource.ts` - User management and JWT operations
- `schema.graphql` - Auth mutations and protected queries
- `resolvers.ts` - Login, logout, and protected data resolvers

### 2. Logging Component (`/logging-component/`)

Provides structured logging and request tracking:

- **Log Storage**: In-memory log storage (production would use external service)
- **Request Correlation**: Links logs to specific requests via request ID
- **Log Levels**: Info, warn, error, debug with filtering
- **GraphQL Integration**: Query logs, view request information

**Key Files:**
- `datasource.ts` - Log storage and querying operations
- `schema.graphql` - Log queries and request info types
- `resolvers.ts` - Protected log access with role checking

### 3. Namespace Component (`/namespace-component/`)

Demonstrates namespace context organization:

- **User Preferences**: Theme, language, timezone settings
- **Business Context**: Tenant info, organization data, feature flags
- **Analytics Context**: Session tracking, device info, geo data
- **Context Factory**: Shows how to build namespace context from global context

**Key Files:**
- `types.ts` - Context interface definitions and module augmentation
- `schema.graphql` - Queries for accessing namespace data
- `index.ts` - Namespace context factory implementation

### 4. Main Server (`/server/`)

Orchestrates the complete middleware chain:

- **Component Integration**: Imports and combines all sub-components
- **Middleware Chain**: Sets up 5-layer middleware processing
- **Apollo Server**: Complete server setup with context, error handling, plugins
- **Request/Response Logging**: Server-level request lifecycle logging

## Middleware Chain

The middleware chain processes each request through 5 layers:

### 1. Request Tracking Middleware
```typescript
component.context.use('request-tracking', async (context) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  
  // Capture request metadata
  const request = {
    requestId,
    startTime,
    userAgent: context.req?.headers?.['user-agent'],
    ip: context.req?.ip || context.req?.connection?.remoteAddress,
    operation: context.operationName,
    variables: context.variables
  };

  return { ...context, request };
});
```

### 2. Authentication Middleware
```typescript
component.context.use('auth', async (context) => {
  const token = context.req?.headers?.authorization?.replace('Bearer ', '');
  
  let user = null;
  let isAuthenticated = false;

  if (token && context.dataSources?.auth) {
    // Data source methods require context as first parameter
    user = await context.dataSources.auth.validateToken(context, token);
    isAuthenticated = !!user;
  }

  // Create auth helper functions
  const authContext = {
    token,
    user: user || undefined,
    isAuthenticated,
    hasRole: (role: string) => user?.roles?.includes(role) || false,
    requireAuth: () => {
      if (!isAuthenticated) throw new Error('Authentication required');
    },
    requireRole: (role: string) => {
      if (!isAuthenticated) throw new Error('Authentication required');
      if (!user?.roles?.includes(role)) throw new Error(`Role '${role}' required`);
    }
  };

  return { ...context, auth: authContext };
});
```

### 3. Business Context Middleware
```typescript
component.context.use('business', async (context) => {
  const businessContext = {
    tenantId: context.req?.headers?.['x-tenant-id'] || 'default-tenant',
    organizationId: context.req?.headers?.['x-org-id'] || 'default-org',
    environment: process.env.NODE_ENV || 'development',
    features: ['feature-a', 'feature-b'], // Would come from feature flags
    quotas: {
      maxUsers: 100,
      maxProjects: 50,
      storageLimit: 1024 * 1024 * 1024 // 1GB
    }
  };

  return { ...context, business: businessContext };
});
```

### 4. Analytics Context Middleware
```typescript
component.context.use('analytics', async (context) => {
  const analyticsContext = {
    sessionId: context.req?.headers?.['x-session-id'] || uuidv4(),
    userId: context.auth?.user?.id,
    deviceId: context.req?.headers?.['x-device-id'] || 'unknown',
    userAgent: context.req?.headers?.['user-agent'] || 'unknown',
    country: context.req?.headers?.['cf-ipcountry'], // Cloudflare header
    city: context.req?.headers?.['cf-ipcity'], // Cloudflare header
    trackingEnabled: context.req?.headers?.['dnt'] !== '1' // Do Not Track
  };

  return { ...context, analytics: analyticsContext };
});
```

### 5. Logging Middleware
```typescript
component.context.use('logging', async (context) => {
  // Log request start
  if (context.dataSources?.logging) {
    // Data source methods require context as first parameter
    await context.dataSources.logging.logEntry(context, {
      level: 'info',
      message: `GraphQL request started: ${context.request?.operation || 'unknown'}`,
      requestId: context.request?.requestId || 'unknown',
      timestamp: new Date().toISOString(),
      operation: context.request?.operation,
      metadata: {
        userAgent: context.request?.userAgent,
        userId: context.auth?.user?.id,
        variables: context.request?.variables
      }
    });
  }

  return context;
});
```

## Running the Example

### Start the Server

```bash
# Install dependencies from project root (if needed)
cd ../../  # Go to project root
npm install

# Start the middleware example server
cd examples/context-middleware
npx ts-node server/index.ts
```

The server will start on `http://localhost:4000` with GraphQL playground available.

### Example Operations

#### 1. Login and Get Token
```graphql
mutation {
  login(input: { username: "admin", password: "admin123" }) {
    token
    user {
      id
      username
      roles
    }
  }
}
```

#### 2. Access Protected Data (requires Authorization header)
```graphql
query {
  protectedData
  me {
    username
    roles
  }
}
```

**Headers:**
```json
{
  "Authorization": "Bearer <token-from-login>"
}
```

#### 3. View Context Information
```graphql
query {
  currentRequest {
    requestId
    operation
    duration
    userAgent
    ip
  }
  
  myPreferences {
    theme
    language
    timezone
    notifications {
      email
      push
      sms
    }
  }
  
  businessInfo {
    tenantId
    organizationId
    environment
    features
    quotas {
      maxUsers
      maxProjects
      storageLimit
    }
  }
  
  contextSummary
}
```

**Headers:**
```json
{
  "X-Tenant-ID": "my-company",
  "X-Session-ID": "session-abc123",
  "X-Device-ID": "device-xyz789"
}
```

#### 4. Admin-Only Operations (requires admin role)
```graphql
query {
  adminOnlyData
  
  recentLogs(limit: 10) {
    level
    message
    timestamp
    requestId
    userId
    operation
    metadata
  }
  
  logsByLevel(level: ERROR) {
    level
    message
    timestamp
    operation
  }
}
```

#### 5. View Request Logs
```graphql
query {
  logsByRequestId(requestId: "your-request-id") {
    level
    message
    timestamp
    duration
    metadata
  }
}
```

### Test Users

The example includes these test users:

| Username | Password | Roles | Description |
|----------|----------|-------|-------------|
| `admin` | `admin123` | `admin`, `user` | Full access to all operations |
| `user` | `user123` | `user` | Basic user access, no admin functions |
| `guest` | `guest123` | `guest` | Limited access |

### Custom Headers

Test different middleware behaviors with these headers:

| Header | Purpose | Example |
|--------|---------|---------|
| `Authorization` | JWT authentication | `Bearer <token>` |
| `X-Tenant-ID` | Multi-tenant context | `acme-corp` |
| `X-Org-ID` | Organization context | `engineering-team` |
| `X-Session-ID` | Session tracking | `session-abc123` |
| `X-Device-ID` | Device tracking | `device-mobile-1` |
| `CF-IPCountry` | Geo location (Cloudflare) | `US` |
| `CF-IPCity` | City location (Cloudflare) | `New York` |
| `DNT` | Do Not Track | `1` (disables tracking) |

## Testing

Run the main project test suite which includes middleware tests:

```bash
cd ../../  # Go to project root
npm test
```

The middleware functionality is tested in the main project tests, including:

- **DataSource Access**: Verifying dataSources are available in middleware
- **Middleware Chaining**: Testing that middleware runs in the correct order
- **Context Building**: Ensuring context is properly constructed through the middleware pipeline
- **Context Tests**: Namespace context access, data composition

### Test Files

- `test/auth.test.ts` - Authentication and authorization testing
- `test/logging.test.ts` - Logging functionality testing  
- `test/middleware.test.ts` - Integration testing of middleware chain

## Key Concepts Demonstrated

### 1. Context Middleware Chaining

The `context.use()` method allows you to build a middleware chain where each middleware:

- Receives the context from the previous middleware
- Can add, modify, or transform context data
- Returns the enhanced context for the next middleware
- Has access to data sources and previous context additions

### 2. Authentication Patterns

- **JWT Token Validation**: Parsing and validating JWT tokens
- **Helper Functions**: Creating auth helpers attached to context
- **Role-Based Access**: Using roles for fine-grained authorization
- **Protected Resolvers**: Requiring auth/roles in resolver functions

### 3. Request Correlation

- **Request IDs**: Unique identifiers for tracking requests
- **Log Correlation**: Linking logs to specific requests
- **Request Metadata**: Capturing user agent, IP, operation details
- **Duration Tracking**: Measuring request processing time

### 4. Namespace Organization

- **Context Namespaces**: Organizing related context data
- **Module Augmentation**: Extending TypeScript interfaces
- **Factory Functions**: Building namespace context from global context
- **Separation of Concerns**: Different components managing different context aspects

### 5. Data Source Integration

- **Context Injection**: Automatic context injection into data source methods (context as first parameter)
- **Middleware Access**: Data sources available in middleware through `context.dataSources`
- **Cross-Component Data**: Data sources shared across imported components
- **Testing Overrides**: Using `dataSourceOverrides` for testing
- **No Temporary Instances**: Middleware can directly use actual component data sources

## Production Considerations

### Security

- **JWT Secrets**: Use strong, rotating secrets in production
- **HTTPS Only**: Ensure tokens are only sent over HTTPS
- **Token Expiration**: Implement proper token expiration and refresh
- **Rate Limiting**: Add rate limiting middleware
- **Input Validation**: Validate all inputs and headers

### Performance

- **Caching**: Cache user data, permissions, and preferences
- **Connection Pooling**: Use connection pooling for databases
- **Async Processing**: Use background jobs for heavy logging operations
- **Monitoring**: Add performance monitoring and alerting

### Scalability

- **External Storage**: Use Redis/database for sessions and logs
- **Distributed Tracing**: Implement distributed tracing for microservices
- **Load Balancing**: Configure load balancing for multiple instances
- **Graceful Shutdown**: Handle graceful shutdown of server instances

### Observability

- **Structured Logging**: Use structured logging with correlation IDs
- **Metrics**: Collect metrics on authentication, errors, and performance
- **Alerting**: Set up alerts for authentication failures and errors
- **Health Checks**: Implement health check endpoints

## Next Steps

After exploring this example, consider:

1. **Advanced Authentication**: Implement OAuth, SAML, or other auth providers
2. **Permissions System**: Build a more sophisticated permissions/RBAC system
3. **Caching Strategies**: Add Redis for session and data caching
4. **Microservices**: Split components into separate services with federation
5. **Real Monitoring**: Integrate with production monitoring tools
6. **Database Integration**: Replace mock data with real database operations

## Related Examples

- **Federation Example**: See how middleware works in a federated architecture
- **Composition Example**: Learn about component composition patterns
- **Data Source Patterns**: Explore advanced data source implementations

This example provides a solid foundation for building production-ready GraphQL APIs with proper authentication, logging, and context management using `graphql-component`. 