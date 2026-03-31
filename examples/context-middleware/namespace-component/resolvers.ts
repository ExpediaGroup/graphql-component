import { IResolvers } from '@graphql-tools/utils';
import { ComponentContext } from '../../../src';
import { UserPreferences, BusinessContext, AnalyticsContext } from './types';

interface ExtendedContext extends ComponentContext {
  userPrefs?: UserPreferences;
  business?: BusinessContext;
  analytics?: AnalyticsContext;
}

export const resolvers: IResolvers = {
  Query: {
    // Access user preferences namespace
    myPreferences(_: any, __: any, context: ExtendedContext) {
      if (!context.userPrefs) {
        return null;
      }
      
      return context.userPrefs;
    },

    // Access business context namespace
    businessInfo(_: any, __: any, context: ExtendedContext) {
      if (!context.business) {
        return null;
      }

      return {
        tenantId: context.business.tenantId,
        organizationId: context.business.organizationId,
        environment: context.business.environment.toUpperCase(),
        features: context.business.features,
        quotas: context.business.quotas
      };
    },

    // Access analytics context namespace
    analyticsInfo(_: any, __: any, context: ExtendedContext) {
      if (!context.analytics) {
        return null;
      }

      return context.analytics;
    },

    // Demonstrate using multiple namespace contexts
    contextSummary(_: any, __: any, context: ExtendedContext) {
      const parts: string[] = [];

      if (context.userPrefs) {
        parts.push(`User prefers ${context.userPrefs.theme} theme in ${context.userPrefs.language}`);
      }

      if (context.business) {
        parts.push(`Organization ${context.business.organizationId} in ${context.business.environment} environment`);
      }

      if (context.analytics) {
        parts.push(`Session ${context.analytics.sessionId} from ${context.analytics.country || 'unknown location'}`);
      }

      if (parts.length === 0) {
        return 'No namespace contexts are available';
      }

      return parts.join('. ');
    }
  }
}; 