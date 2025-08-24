import { config } from '../config.js';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: any;
}

/**
 * Simple structured logger
 */
class Logger {
  private levels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
  };
  
  private currentLevel = this.levels[config.logging.level as LogLevel] || this.levels.info;
  
  private shouldLog(level: LogLevel): boolean {
    return this.levels[level] >= this.currentLevel;
  }
  
  private formatMessage(level: LogLevel, message: string, data?: any): string {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data
    };
    
    if (config.nodeEnv === 'development') {
      // Pretty format for development
      const emoji = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : level === 'info' ? 'ℹ️' : '🐛';
      const dataStr = data ? `\n${JSON.stringify(data, null, 2)}` : '';
      return `${emoji} ${entry.timestamp} [${level.toUpperCase()}] ${message}${dataStr}`;
    } else {
      // JSON format for production
      return JSON.stringify(entry);
    }
  }
  
  debug(message: string, data?: any): void {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage('debug', message, data));
    }
  }
  
  info(message: string, data?: any): void {
    if (this.shouldLog('info')) {
      console.log(this.formatMessage('info', message, data));
    }
  }
  
  warn(message: string, data?: any): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, data));
    }
  }
  
  error(message: string, data?: any): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message, data));
    }
  }
  
  /**
   * Log scraping metrics periodically
   */
  logMetrics(metricsData: any): void {
    this.info('Scraper metrics update', metricsData);
  }
}

export const logger = new Logger();