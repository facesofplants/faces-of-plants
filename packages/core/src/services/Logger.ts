/**
 * Structured logging service for production-ready observability
 * Implements JSON-formatted logging with request IDs for tracing
 */

export type LogLevel = 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';

export interface LogContext {
  requestId: string;
  userId?: string;
  operation: string;
  duration?: number;
  [key: string]: any;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  requestId: string;
  userId?: string;
  operation: string;
  duration?: number;
  error?: {
    name: string;
    message: string;
    stack: string;
  };
  context: Record<string, any>;
}

export interface LoggerConfig {
  minLevel?: LogLevel;
  enableConsole?: boolean;
  formatJson?: boolean;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

export class Logger {
  private config: Required<LoggerConfig>;

  constructor(config: LoggerConfig = {}) {
    this.config = {
      minLevel: config.minLevel || 'INFO',
      enableConsole: config.enableConsole !== false,
      formatJson: config.formatJson !== false,
    };
  }

  /**
   * Log an informational message
   */
  info(message: string, context: LogContext): void {
    this.log('INFO', message, context);
  }

  /**
   * Log a warning message
   */
  warn(message: string, context: LogContext): void {
    this.log('WARN', message, context);
  }

  /**
   * Log an error message with error details
   */
  error(message: string, error: Error, context: LogContext): void {
    this.log('ERROR', message, context, error);
  }

  /**
   * Log a debug message
   */
  debug(message: string, context: LogContext): void {
    this.log('DEBUG', message, context);
  }

  /**
   * Internal logging method that formats and outputs log entries
   */
  private log(level: LogLevel, message: string, context: LogContext, error?: Error): void {
    // Check if this log level should be output
    if (LOG_LEVELS[level] < LOG_LEVELS[this.config.minLevel]) {
      return;
    }

    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      requestId: context.requestId,
      userId: context.userId,
      operation: context.operation,
      duration: context.duration,
      context: this.extractAdditionalContext(context),
      ...(error && {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack || '',
        },
      }),
    };

    if (this.config.enableConsole) {
      this.output(logEntry);
    }
  }

  /**
   * Extract additional context fields beyond the standard ones
   */
  private extractAdditionalContext(context: LogContext): Record<string, any> {
    const { requestId, userId, operation, duration, ...additional } = context;
    return additional;
  }

  /**
   * Output the log entry to console
   */
  private output(logEntry: LogEntry): void {
    const output = this.config.formatJson
      ? JSON.stringify(logEntry)
      : this.formatHumanReadable(logEntry);

    // Use appropriate console method based on level
    switch (logEntry.level) {
      case 'ERROR':
        console.error(output);
        break;
      case 'WARN':
        console.warn(output);
        break;
      case 'DEBUG':
        console.debug(output);
        break;
      default:
        console.log(output);
    }
  }

  /**
   * Format log entry for human-readable output (development)
   */
  private formatHumanReadable(logEntry: LogEntry): string {
    const parts = [
      `[${logEntry.timestamp}]`,
      `[${logEntry.level}]`,
      `[${logEntry.requestId}]`,
      logEntry.userId ? `[User: ${logEntry.userId}]` : '',
      `[${logEntry.operation}]`,
      logEntry.message,
    ].filter(Boolean);

    if (logEntry.duration !== undefined) {
      parts.push(`(${logEntry.duration}ms)`);
    }

    if (logEntry.error) {
      parts.push(`\nError: ${logEntry.error.name}: ${logEntry.error.message}`);
      if (logEntry.error.stack) {
        parts.push(`\n${logEntry.error.stack}`);
      }
    }

    if (Object.keys(logEntry.context).length > 0) {
      parts.push(`\nContext: ${JSON.stringify(logEntry.context, null, 2)}`);
    }

    return parts.join(' ');
  }

  /**
   * Set the minimum log level
   */
  setMinLevel(level: LogLevel): void {
    this.config.minLevel = level;
  }

  /**
   * Get the current minimum log level
   */
  getMinLevel(): LogLevel {
    return this.config.minLevel;
  }
}

/**
 * Default logger instance for application-wide use
 */
export const logger = new Logger({
  minLevel: (process.env.LOG_LEVEL as LogLevel) || 'INFO',
  enableConsole: true,
  formatJson: process.env.NODE_ENV === 'production',
});
