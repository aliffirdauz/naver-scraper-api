import { config } from '../config.js';

/**
 * Sleep with jitter for more natural request patterns
 */
export function sleep(ms: number, jitter = 0.2): Promise<void> {
  const jitterMs = ms * jitter * (Math.random() - 0.5);
  const actualMs = Math.max(100, ms + jitterMs);
  return new Promise(resolve => setTimeout(resolve, actualMs));
}

/**
 * Exponential backoff with jitter
 */
export function calculateBackoffDelay(attempt: number, baseDelayMs = 1000): number {
  const exponentialDelay = Math.min(baseDelayMs * Math.pow(2, attempt), 30000);
  const jitter = exponentialDelay * 0.3 * Math.random();
  return exponentialDelay + jitter;
}

/**
 * Check if HTTP status should trigger a retry
 */
export function shouldRetry(status: number, attempt: number, maxRetries: number): boolean {
  if (attempt >= maxRetries) return false;
  
  // Retry on server errors and rate limits
  const retryableStatuses = [429, 500, 502, 503, 504, 520, 521, 522, 524];
  return retryableStatuses.includes(status);
}

/**
 * Circuit Breaker for burst error protection
 * Prevents cascade failures by failing fast when error rate is high
 */
export class CircuitBreaker {
  private failures = 0;
  private successes = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  
  constructor(
    private threshold = config.scraper.circuitBreakerThreshold,
    private timeout = 60000 // 1 minute
  ) {}
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN - failing fast');
      }
    }
    
    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess(): void {
    this.successes++;
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      this.failures = 0;
    }
  }
  
  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    const totalRequests = this.failures + this.successes;
    const errorRate = totalRequests > 0 ? (this.failures / totalRequests) * 100 : 0;
    
    if (errorRate > this.threshold && totalRequests >= 10) {
      this.state = 'OPEN';
    }
  }
  
  getState(): { state: string; failures: number; successes: number; errorRate: number } {
    const totalRequests = this.failures + this.successes;
    const errorRate = totalRequests > 0 ? (this.failures / totalRequests) * 100 : 0;
    
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      errorRate: Number(errorRate.toFixed(2))
    };
  }
  
  reset(): void {
    this.failures = 0;
    this.successes = 0;
    this.state = 'CLOSED';
    this.lastFailureTime = 0;
  }
}

/**
 * Retry wrapper with exponential backoff
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelayMs?: number;
    shouldRetryFn?: (error: any, attempt: number) => boolean;
    onRetry?: (error: any, attempt: number) => void;
  } = {}
): Promise<T> {
  const {
    maxRetries = config.scraper.maxRetries,
    baseDelayMs = 1000,
    shouldRetryFn,
    onRetry
  } = options;
  
  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      if (attempt === maxRetries) break;
      
      // Check if we should retry
      const shouldRetryDefault = error.status ? shouldRetry(error.status, attempt, maxRetries) : true;
      const shouldRetryCustom = shouldRetryFn ? shouldRetryFn(error, attempt) : shouldRetryDefault;
      
      if (!shouldRetryCustom) break;
      
      // Calculate delay
      const delay = calculateBackoffDelay(attempt, baseDelayMs);
      
      // Notify about retry
      if (onRetry) {
        onRetry(error, attempt);
      }
      
      // Wait before retry
      await sleep(delay);
    }
  }
  
  throw lastError;
}