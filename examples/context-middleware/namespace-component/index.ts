import { readFileSync } from 'fs';
import { join } from 'path';
import GraphQLComponent from '../../../src';
import { resolvers } from './resolvers';
import { UserPreferences, BusinessContext, AnalyticsContext } from './types';

const types = readFileSync(join(__dirname, 'schema.graphql'), 'utf-8');

export default class NamespaceComponent extends GraphQLComponent {
  constructor(options = {}) {
    super({
      types,
      resolvers,
      // Demonstrate namespace context configuration
      context: {
        namespace: 'userPrefs',
        factory: async function (globalContext: any): Promise<UserPreferences> {
          // This would typically come from a user preferences service
          // based on the authenticated user
          const userId = globalContext.auth?.user?.id;
          
          if (!userId) {
            return {
              theme: 'light',
              language: 'en',
              timezone: 'UTC',
              notifications: {
                email: true,
                push: false,
                sms: false
              }
            };
          }

          // Mock user preferences based on user ID
          const preferences: UserPreferences = {
            theme: userId === '1' ? 'dark' : 'light',
            language: userId === '1' ? 'en' : 'es',
            timezone: userId === '1' ? 'America/New_York' : 'Europe/Madrid',
            notifications: {
              email: true,
              push: userId === '1',
              sms: false
            }
          };

          return preferences;
        }
      },
      ...options
    });
  }
}

export * from './types'; 