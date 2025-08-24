import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Proxy
  proxy: {
    enabled: process.env.PROXY_ROTATION === 'on',
    host: process.env.PROXY_HOST,
    port: process.env.PROXY_PORT ? parseInt(process.env.PROXY_PORT, 10) : undefined,
    username: process.env.PROXY_USERNAME,
    password: process.env.PROXY_PASSWORD,
  },
  
  // Performance & Rate Limiting
  scraper: {
    maxConcurrentRequests: parseInt(process.env.MAX_CONCURRENT_REQUESTS || '10', 10),
    requestsPerHour: parseInt(process.env.REQUESTS_PER_HOUR || '200', 10),
    defaultTimeoutMs: parseInt(process.env.DEFAULT_TIMEOUT_MS || '8000', 10),
    maxRetries: parseInt(process.env.MAX_RETRIES || '3', 10),
    
    // Delays
    minDelayMs: parseInt(process.env.MIN_DELAY_MS || '500', 10),
    maxDelayMs: parseInt(process.env.MAX_DELAY_MS || '2000', 10),
    
    // Circuit breaker
    circuitBreakerThreshold: parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD || '50', 10),
  },
  
  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    toFile: process.env.LOG_TO_FILE === 'true',
  },
  
  // Target URLs
  naver: {
    baseUrl: 'https://search.shopping.naver.com',
    apiPath: '/ns/v1/search/paged-composite-cards',
  },
} as const;

// Validation
if (config.proxy.enabled && (!config.proxy.host || !config.proxy.port)) {
  throw new Error('Proxy enabled but PROXY_HOST or PROXY_PORT not configured');
}