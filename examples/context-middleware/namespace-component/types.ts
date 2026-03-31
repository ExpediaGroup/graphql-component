export interface UserPreferences {
  theme: 'light' | 'dark';
  language: string;
  timezone: string;
  notifications: {
    email: boolean;
    push: boolean;
    sms: boolean;
  };
}

export interface BusinessContext {
  tenantId: string;
  organizationId: string;
  environment: 'development' | 'staging' | 'production';
  features: string[];
  quotas: {
    maxUsers: number;
    maxProjects: number;
    storageLimit: number;
  };
}

export interface AnalyticsContext {
  sessionId: string;
  userId?: string;
  deviceId: string;
  userAgent: string;
  country?: string;
  city?: string;
  trackingEnabled: boolean;
}

// Extending ComponentContext to show how namespaces work
declare module '../../../src' {
  interface ComponentContext {
    // Namespaced contexts
    userPrefs?: UserPreferences;
    business?: BusinessContext;
    analytics?: AnalyticsContext;
  }
} 