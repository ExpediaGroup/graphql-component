import { IResolvers } from '@graphql-tools/utils';
import { ComponentContext } from '../../../src';
import { LogEntry } from './types';

interface ExtendedContext extends ComponentContext {
  auth?: {
    isAuthenticated: boolean;
    user?: any;
    requireAuth: () => void;
    requireRole: (role: string) => void;
  };
  request?: {
    requestId: string;
    startTime: number;
    userAgent?: string;
    ip?: string;
    operation?: string;
    variables?: any;
  };
}

export const resolvers: IResolvers = {
  Query: {
    // Admin-only query to view recent logs
    async recentLogs(_: any, { limit = 100 }: { limit?: number }, context: ExtendedContext) {
      // Require admin access for viewing logs
      if (context.auth) {
        context.auth.requireAuth();
        context.auth.requireRole('admin');
      }
      
      return context.dataSources.logging.getRecentLogs(limit);
    },

    // Get logs for a specific request (users can see their own request logs)
    async logsByRequestId(_: any, { requestId }: { requestId: string }, context: ExtendedContext) {
      if (context.auth) {
        context.auth.requireAuth();
      }
      
      return context.dataSources.logging.getLogsByRequestId(requestId);
    },

    // Admin-only query to filter logs by level
    async logsByLevel(_: any, { level }: { level: string }, context: ExtendedContext) {
      if (context.auth) {
        context.auth.requireAuth();
        context.auth.requireRole('admin');
      }
      
      return context.dataSources.logging.getLogsByLevel(level.toLowerCase() as LogEntry['level']);
    },

    // Get current request information
    currentRequest(_: any, __: any, context: ExtendedContext) {
      if (!context.request) {
        return null;
      }

      const duration = context.dataSources.logging.calculateDuration(context.request.startTime);

      return {
        requestId: context.request.requestId,
        startTime: new Date(context.request.startTime).toISOString(),
        userAgent: context.request.userAgent,
        ip: context.request.ip,
        operation: context.request.operation,
        variables: context.request.variables ? JSON.stringify(context.request.variables) : null,
        duration
      };
    }
  },

  LogEntry: {
    // Transform metadata object to JSON string
    metadata(logEntry: LogEntry) {
      return logEntry.metadata ? JSON.stringify(logEntry.metadata) : null;
    }
  }
}; 