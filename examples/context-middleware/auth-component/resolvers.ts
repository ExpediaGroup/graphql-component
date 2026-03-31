import { IResolvers } from '@graphql-tools/utils';
import { ComponentContext } from '../../../src';
import { AuthContext, LoginInput } from './types';

interface ExtendedContext extends ComponentContext {
  auth: AuthContext;
}

export const resolvers: IResolvers = {
  Query: {
    // Public field - anyone can call this if they have a valid token
    me(_: any, __: any, context: ExtendedContext) {
      if (!context.auth.isAuthenticated) {
        return null;
      }
      return context.auth.user;
    },

    // Protected field - requires authentication
    protectedData(_: any, __: any, context: ExtendedContext) {
      // Use the auth helper to require authentication
      context.auth.requireAuth();
      
      return `This is protected data accessible to user: ${context.auth.user?.username}`;
    },

    // Admin-only field - requires admin role
    adminOnlyData(_: any, __: any, context: ExtendedContext) {
      // Require both authentication and admin role
      context.auth.requireAuth();
      context.auth.requireRole('admin');
      
      return 'This is admin-only data that only admins can see';
    },

    // Protected field that lists all users - requires authentication
    async users(_: any, __: any, context: ExtendedContext) {
      context.auth.requireAuth();
      return context.dataSources.auth.getAllUsers();
    }
  },

  Mutation: {
    async login(_: any, { input }: { input: LoginInput }, context: ComponentContext) {
      return context.dataSources.auth.login(input);
    },

    logout(_: any, __: any, context: ExtendedContext) {
      // In a real app, you might invalidate the token in a blacklist
      // For this example, we just return true
      // The client should remove the token from storage
      return true;
    }
  }
}; 