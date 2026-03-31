import { ComponentContext, DataSourceDefinition, IDataSource } from '../../../src';
import { LogEntry, RequestContext } from './types';

export default class LoggingDataSource implements DataSourceDefinition<LoggingDataSource>, IDataSource {
  name = 'logging';

  // In a real app, this would write to a file, database, or external service
  private logs: LogEntry[] = [];

  async logEntry(context: ComponentContext, entry: LogEntry): Promise<void> {
    // Add additional context from the request
    const enhancedEntry: LogEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
      // Extract user info from context if available
      userId: (context as any).auth?.user?.id,
      // Extract request info
      requestId: (context as any).request?.requestId || 'unknown',
    };

    this.logs.push(enhancedEntry);
    
    // In production, you'd write to your logging system
    console.log(`[${enhancedEntry.level.toUpperCase()}] ${enhancedEntry.message}`, {
      requestId: enhancedEntry.requestId,
      userId: enhancedEntry.userId,
      timestamp: enhancedEntry.timestamp,
      metadata: enhancedEntry.metadata
    });
  }

  async getLogsByRequestId(context: ComponentContext, requestId: string): Promise<LogEntry[]> {
    return this.logs.filter(log => log.requestId === requestId);
  }

  async getRecentLogs(context: ComponentContext, limit: number = 100): Promise<LogEntry[]> {
    return this.logs
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  async getLogsByUserId(context: ComponentContext, userId: string): Promise<LogEntry[]> {
    return this.logs.filter(log => log.userId === userId);
  }

  async getLogsByLevel(context: ComponentContext, level: LogEntry['level']): Promise<LogEntry[]> {
    return this.logs.filter(log => log.level === level);
  }

  // Helper method to calculate request duration
  calculateDuration(context: ComponentContext, startTime: number): number {
    return Date.now() - startTime;
  }

  // In production, you might have methods for log rotation, cleanup, etc.
  async cleanup(context: ComponentContext, olderThanDays: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    
    const initialCount = this.logs.length;
    this.logs = this.logs.filter(log => new Date(log.timestamp) > cutoffDate);
    
    return initialCount - this.logs.length;
  }
} 