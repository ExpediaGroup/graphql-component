export interface RequestContext {
  requestId: string;
  startTime: number;
  userAgent?: string;
  ip?: string;
  operation?: string;
  variables?: any;
}

export interface LogEntry {
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  requestId: string;
  timestamp: string;
  duration?: number;
  userId?: string;
  operation?: string;
  error?: Error;
  metadata?: Record<string, any>;
}

export interface Logger {
  info: (message: string, metadata?: Record<string, any>) => void;
  warn: (message: string, metadata?: Record<string, any>) => void;
  error: (message: string, error?: Error, metadata?: Record<string, any>) => void;
  debug: (message: string, metadata?: Record<string, any>) => void;
}

export interface LoggingContext {
  logger: Logger;
  request: RequestContext;
} 