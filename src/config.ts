import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Proxy - Essential for Indonesia -> Korea access
  proxy: {
    enabled: process.env.PROXY_ROTATION !== 'off', // Default to ON for geo-restriction bypass
    host: process.env.PROXY_HOST,
    port: process.env.PROXY_PORT ? parseInt(process.env.PROXY_PORT, 10) : undefined,
    username: process.env.PROXY_USERNAME,
    password: process.env.PROXY_PASSWORD,
    // Additional proxy settings
    testOnStartup: process.env.PROXY_TEST_ON_STARTUP !== 'false',
    timeout: parseInt(process.env.PROXY_TIMEOUT_MS || '30000', 10),
  },
  
  // Performance tuned for proxy usage
  scraper: {
    maxConcurrentRequests: parseInt(process.env.MAX_CONCURRENT_REQUESTS || '3', 10), // Lower for proxy stability
    requestsPerHour: parseInt(process.env.REQUESTS_PER_HOUR || '150', 10),
    defaultTimeoutMs: parseInt(process.env.DEFAULT_TIMEOUT_MS || '25000', 10), // Higher for proxy latency
    maxRetries: parseInt(process.env.MAX_RETRIES || '5', 10), // More retries for proxy issues
    
    // Delays - Higher for proxy stability
    minDelayMs: parseInt(process.env.MIN_DELAY_MS || '2000', 10), 
    maxDelayMs: parseInt(process.env.MAX_DELAY_MS || '5000', 10),
    
    // Circuit breaker - More lenient for proxy
    circuitBreakerThreshold: parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD || '40', 10),
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
  
  // HTTP settings optimized for proxy
  http: {
    keepAlive: true,
    keepAliveTimeout: 60000, // Longer for proxy connections
    maxSockets: 5, // Lower for proxy stability
    followRedirects: true,
    maxRedirects: 5,
    rejectUnauthorized: false, // Important for proxy SSL
  }
} as const;

// Enhanced validation for proxy setup
if (config.proxy.enabled) {
  console.log('🌐 Proxy configuration check...');
  
  if (!config.proxy.host || !config.proxy.port) {
    console.error('❌ PROXY_HOST and PROXY_PORT are required when proxy is enabled');
    console.error('   Set PROXY_ROTATION=off to disable, or configure proxy settings');
    process.exit(1);
  }
  
  if (!config.proxy.username || !config.proxy.password) {
    console.warn('⚠️  No proxy authentication configured (username/password)');
    console.warn('   This may work for some proxies but not others');
  }
  
  console.log(`✅ Proxy configured: ${config.proxy.host}:${config.proxy.port}`);
  console.log(`   Authentication: ${config.proxy.username ? 'Yes' : 'No'}`);
  console.log(`   Test on startup: ${config.proxy.testOnStartup ? 'Yes' : 'No'}`);
} else {
  console.warn('⚠️  Proxy DISABLED - Direct access from Indonesia to Naver may fail');
  console.warn('   Consider enabling proxy with PROXY_ROTATION=on');
}

// Validate other critical settings
if (config.scraper.defaultTimeoutMs < 15000) {
  console.warn('⚠️  Timeout may be too low for proxy connections (recommended: 20000ms+)');
}

if (config.scraper.maxConcurrentRequests > 5) {
  console.warn('⚠️  High concurrency may overwhelm proxy (recommended: 3 or lower)');
}