import { ApolloServer } from 'apollo-server';
import { v4 as uuidv4 } from 'uuid';
import GraphQLComponent from '../../../src';

// Import our components
import AuthComponent from '../auth-component';
import LoggingComponent from '../logging-component';
import NamespaceComponent from '../namespace-component';

// Import types for context middleware
import { AuthContext } from '../auth-component/types';
import { LoggingContext, RequestContext } from '../logging-component/types';
import { BusinessContext, AnalyticsContext } from '../namespace-component/types';

// Create the main component that imports all sub-components
class MainComponent extends GraphQLComponent {
  constructor() {
    const authComponent = new AuthComponent();
    const loggingComponent = new LoggingComponent();
    const namespaceComponent = new NamespaceComponent();

    super({
      imports: [authComponent, loggingComponent, namespaceComponent]
    });
    
    // Add context middleware that runs after data sources are available
    this.context.use('auth-context', async (globalContext: any) => {
      return await buildContextWithAuth(globalContext);
    });
  }
}

// Context factory that has access to data sources
async function buildContextWithAuth(globalContext: any) {
  const requestId = uuidv4();
  const startTime = Date.now();
  
  // Extract request information from Apollo Server context
  const request: RequestContext = {
    requestId,
    startTime,
    userAgent: globalContext.req?.headers?.['user-agent'],
    ip: globalContext.req?.ip || globalContext.req?.connection?.remoteAddress,
    operation: globalContext.operationName || undefined,
    variables: globalContext.variables
  };

  // Data sources are now available in middleware!
  console.log(`🔄 Request ${requestId} started: ${globalContext.operationName || 'unknown operation'}`);

  // Access authentication from the global context
  const authHeader = globalContext.req?.headers?.authorization;
  
  const token = authHeader?.replace('Bearer ', '');
  
  let user: any = null;
  let isAuthenticated = false;

  if (token && globalContext.dataSources?.auth) {
    try {
      // Now we can use the actual auth data source!
      user = await globalContext.dataSources.auth.validateToken(token);
      isAuthenticated = !!user;
    } catch (error) {
      console.log(`❌ Token validation error: ${error.message}`);
    }
  } else {
    console.log(`🔍 No token provided or auth data source not available`);
  }

  // Create auth helper functions
  const authContext: AuthContext = {
    token,
    user: user || undefined,
    isAuthenticated,
    hasRole: (role: string) => {
      return user?.roles?.includes(role) || false;
    },
    requireAuth: () => {
      if (!isAuthenticated) {
        throw new Error('Authentication required');
      }
    },
    requireRole: (role: string) => {
      if (!isAuthenticated) {
        throw new Error('Authentication required');
      }
      if (!user?.roles?.includes(role)) {
        throw new Error(`Role '${role}' required`);
      }
    }
  };

  if (isAuthenticated && user) {
    console.log(`✅ Authenticated user: ${user.username} (${user.roles.join(', ')})`);
  } else {
    console.log(`❌ Authentication failed`);
  }

  // Build business context
  const businessContext: BusinessContext = {
    tenantId: globalContext.req?.headers?.['x-tenant-id'] || 'default-tenant',
    organizationId: globalContext.req?.headers?.['x-org-id'] || 'default-org',
    environment: (process.env.NODE_ENV as any) || 'development',
    features: ['feature-a', 'feature-b'],
    quotas: {
      maxUsers: 100,
      maxProjects: 50,
      storageLimit: 1024 * 1024 * 1024
    }
  };

  // Build analytics context  
  const analyticsContext: AnalyticsContext = {
    sessionId: globalContext.req?.headers?.['x-session-id'] || uuidv4(),
    userId: authContext.user?.id,
    deviceId: globalContext.req?.headers?.['x-device-id'] || 'unknown',
    userAgent: globalContext.req?.headers?.['user-agent'] || 'unknown',
    country: globalContext.req?.headers?.['cf-ipcountry'],
    city: globalContext.req?.headers?.['cf-ipcity'],
    trackingEnabled: globalContext.req?.headers?.['dnt'] !== '1'
  };

  // Log request start using the actual logging data source
  if (globalContext.dataSources?.logging) {
    try {
      await globalContext.dataSources.logging.logEntry(globalContext, {
        level: 'info',
        message: `GraphQL request started: ${request.operation || 'unknown'}`,
        requestId: request.requestId || 'unknown',
        timestamp: new Date().toISOString(),
        operation: request.operation,
        metadata: {
          userAgent: request.userAgent,
          userId: authContext.user?.id,
          variables: request.variables
        }
      });
    } catch (error) {
      console.log(`⚠️ Logging failed: ${error.message}`);
    }
  }

  return {
    request,
    auth: authContext,
    business: businessContext,
    analytics: analyticsContext
  };
}

const createServer = (): ApolloServer => {
  const component = new MainComponent();

  const server = new ApolloServer({
    schema: component.schema,
    context: component.context,
    
    // Custom error formatting that uses our logging
    formatError: (error) => {
      console.error('GraphQL Error:', error);
      
      // In a real app, you'd log this error using the logging data source
      // but since we're in the error handler, we don't have easy access to context
      
      return {
        message: error.message,
        // Only include error details in development
        ...(process.env.NODE_ENV === 'development' && {
          locations: error.locations,
          path: error.path,
          extensions: error.extensions
        })
      };
    },

    // Add request/response logging
    plugins: [
      {
        requestDidStart() {
          return Promise.resolve({
            async didResolveOperation(requestContext: any) {
              console.log(`📝 Operation: ${requestContext.operationName || 'anonymous'}`);
            },
            
            async willSendResponse(requestContext: any) {
              const duration = Date.now() - (requestContext.context.request?.startTime || Date.now());
              console.log(`✨ Request completed in ${duration}ms`);
            }
          });
        }
      }
    ]
  });

  return server;
};

// Start the server
const startServer = async (): Promise<void> => {
  const server = createServer();
  
  const { url } = await server.listen({ port: 4000 });
  
  console.log('🚀 Context & Middleware Example Server ready!');
  console.log(`📍 Server URL: ${url}`);
  console.log('\n📚 Try these operations:');
  console.log('1. Login: mutation { login(input: { username: "admin", password: "admin123" }) { token user { username roles } } }');
  console.log('2. Get protected data: query { protectedData } (requires Authorization header)');
  console.log('3. View context info: query { currentRequest { requestId duration } myPreferences { theme } }');
  console.log('4. Admin logs: query { recentLogs { message timestamp level } } (requires admin role)');
  console.log('\n💡 Headers to try:');
  console.log('- Authorization: Bearer <token-from-login>');
  console.log('- X-Tenant-ID: my-tenant');
  console.log('- X-Session-ID: session-123');
};

// Export for testing
export { createServer };

// Start server if this file is run directly
if (require.main === module) {
  startServer().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
} 