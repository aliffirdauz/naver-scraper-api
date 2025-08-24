import Fastify from 'fastify';
import pLimit from 'p-limit';
import { fetchPagedCompositeCards, getCircuitBreakerStatus, resetCircuitBreaker } from './scraper/index.js';
import { cookieManager } from './scraper/cookies.js'
import { metrics } from './utils/metrics.js';
import { logger } from './utils/logger.js';
import { config } from './config.js';

// Rate limiting
const limit = pLimit(config.scraper.maxConcurrentRequests);

// Create Fastify instance
const fastify = Fastify({
  logger: config.nodeEnv === 'development' ? {
    level: 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true
      }
    }
  } : true
});

// Health check endpoint
fastify.get('/health', async (request, reply) => {
  const circuitBreakerState = getCircuitBreakerStatus();
  const metricsData = metrics.getMetrics();
  const sla = metrics.checkSLA();
  
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
    circuitBreaker: circuitBreakerState,
    sla: sla,
    metrics: {
      totalRequests: metricsData.totalRequests,
      successRate: metrics.getSuccessRate(),
      averageLatency: metricsData.averageLatencyMs
    }
  };
  
  const statusCode = sla.avgLatencyOk && sla.errorRateOk ? 200 : 503;
  
  return reply.code(statusCode).send(health);
});

// Metrics endpoint
fastify.get('/metrics', async (request, reply) => {
  const metricsData = metrics.getMetrics();
  const circuitBreakerState = getCircuitBreakerStatus();
  
  return reply.send({
    ...metricsData,
    successRate: metrics.getSuccessRate(),
    circuitBreaker: circuitBreakerState,
    sla: metrics.checkSLA()
  });
});

// Reset metrics endpoint (useful for testing)
fastify.post('/metrics/reset', async (request, reply) => {
  metrics.reset();
  resetCircuitBreaker();
  cookieManager.refreshSession(); // Also refresh cookies
  logger.info('Metrics, circuit breaker, and cookies reset');
  
  return reply.send({ 
    message: 'Metrics, circuit breaker, and cookies reset successfully',
    timestamp: new Date().toISOString()
  });
});

// Main scraping endpoint
fastify.get('/naver', async (request, reply) => {
  const query = request.query as { url?: string };
  
  if (!query.url) {
    return reply.code(400).send({
      error: 'Missing required parameter: url',
      message: 'Please provide a Naver shopping URL via ?url= parameter',
      example: '/naver?url=https://search.shopping.naver.com/ns/search?query=iphone'
    });
  }
  
  try {
    // Validate URL format
    new URL(query.url);
  } catch (error) {
    return reply.code(400).send({
      error: 'Invalid URL format',
      message: 'Please provide a valid URL',
      provided: query.url
    });
  }
  
  try {
    logger.info(`Scraping request received`, { url: query.url });
    
    // Use rate limiting to control concurrency
    const result = await limit(() => fetchPagedCompositeCards(query.url!));
    
    logger.info(`Scraping completed successfully`, {
      url: query.url,
      latency: result.metadata.latencyMs,
      attempts: result.metadata.attempts
    });
    
    return reply.send({
      success: true,
      ...result
    });
    
  } catch (error: any) {
    logger.error(`Scraping failed`, {
      url: query.url,
      error: error.message,
      stack: error.stack
    });
    
    // Determine appropriate HTTP status code
    let statusCode = 500;
    if (error.message.includes('Circuit breaker is OPEN')) {
      statusCode = 503; // Service Unavailable
    } else if (error.message.includes('HTTP 4')) {
      statusCode = 502; // Bad Gateway
    } else if (error.message.includes('timeout')) {
      statusCode = 504; // Gateway Timeout
    }
    
    return reply.code(statusCode).send({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
      url: query.url
    });
  }
});

// Batch scraping endpoint (bonus feature)
fastify.post('/naver/batch', async (request, reply) => {
  const body = request.body as { urls?: string[]; concurrency?: number };
  
  if (!body.urls || !Array.isArray(body.urls) || body.urls.length === 0) {
    return reply.code(400).send({
      error: 'Missing or invalid urls array',
      message: 'Please provide an array of Naver shopping URLs in the request body'
    });
  }
  
  if (body.urls.length > 100) {
    return reply.code(400).send({
      error: 'Too many URLs',
      message: 'Maximum 100 URLs per batch request'
    });
  }
  
  const concurrency = Math.min(body.concurrency || config.scraper.maxConcurrentRequests, 20);
  
  try {
    logger.info(`Batch scraping request received`, { 
      urlCount: body.urls.length, 
      concurrency 
    });
    
    const results = await Promise.allSettled(
      body.urls.map(url => 
        limit(() => fetchPagedCompositeCards(url))
      )
    );
    
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.length - successful;
    
    logger.info(`Batch scraping completed`, {
      total: body.urls.length,
      successful,
      failed,
      successRate: ((successful / results.length) * 100).toFixed(2) + '%'
    });
    
    return reply.send({
      success: true,
      summary: {
        total: body.urls.length,
        successful,
        failed,
        successRate: successful / results.length
      },
      results: results.map((result, index) => ({
        url: body.urls![index],
        success: result.status === 'fulfilled',
        data: result.status === 'fulfilled' ? result.value : undefined,
        error: result.status === 'rejected' ? result.reason.message : undefined
      }))
    });
    
  } catch (error: any) {
    logger.error(`Batch scraping failed`, {
      urlCount: body.urls.length,
      error: error.message
    });
    
    return reply.code(500).send({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Error handler
fastify.setErrorHandler((error, request, reply) => {
  logger.error(`Unhandled error`, {
    method: request.method,
    url: request.url,
    error: error.message,
    stack: error.stack
  });
  
  reply.status(500).send({
    success: false,
    error: 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// Graceful shutdown
const gracefulShutdown = async () => {
  logger.info('Received shutdown signal, closing server gracefully...');
  
  try {
    await fastify.close();
    logger.info('Server closed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', error);
    process.exit(1);
  }
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start server
const start = async () => {
  try {
    await fastify.listen({ 
      port: config.port, 
      host: '0.0.0.0' // Allow external connections for ngrok
    });
    
    logger.info(`🚀 Server running on http://localhost:${config.port}`);
    logger.info(`📊 Health check: http://localhost:${config.port}/health`);
    logger.info(`📈 Metrics: http://localhost:${config.port}/metrics`);
    logger.info(`🔧 Circuit breaker threshold: ${config.scraper.circuitBreakerThreshold}%`);
    logger.info(`🌐 Proxy enabled: ${config.proxy.enabled ? 'Yes' : 'No'}`);
    
    // Log metrics every 30 seconds
    setInterval(() => {
      const metricsData = metrics.getMetrics();
      if (metricsData.totalRequests > 0) {
        logger.info(`📊 ${metrics.getSummary()}`);
      }
    }, 30000);
    
  } catch (err) {
    logger.error('Failed to start server', err);
    process.exit(1);
  }
};

start();