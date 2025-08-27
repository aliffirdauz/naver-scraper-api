import { request } from "undici";
import { ProxyAgent } from "undici";
import {
  generateFingerprint,
  fingerprintToHeaders,
} from "./headers.js";
import { withRetry, CircuitBreaker, sleep } from "./retry.js";
import { proxyPool } from "./proxy.js";
import { cookieManager } from "./cookies.js";
import {
  NaverPagedCompositeCardsSchema,
  ScrapedResponse,
  ScrapeOptions,
} from "./types.js";
import {
  normalizeToApiUrl,
  parseNaverUrl,
  buildRefererUrl,
} from "../utils/url-parser.js";
import { metrics } from "../utils/metrics.js";
import { logger } from "../utils/logger.js";
import { config } from "../config.js";

// Global circuit breaker instance
const circuitBreaker = new CircuitBreaker();

/**
 * Sanitize header values more carefully
 */
function sanitizeHeaderValue(value: string): string {
  if (!value || typeof value !== 'string') return '';
  
  return value
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control chars but keep Unicode
    .replace(/[\r\n]/g, '') // Remove line breaks
    .trim();
}

/**
 * Build headers that exactly match the working cURL request
 */
function buildNaverHeaders(query: string): Record<string, string> {
  // Use the exact working user agent from your cURL
  const userAgent = 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36 Edg/139.0.0.0';
  
  // Build referer with proper query encoding
  const encodedQuery = encodeURIComponent(query);
  const referer = `https://search.shopping.naver.com/ns/search?query=${encodedQuery}&score=4.8%7C5`;
  
  // Headers exactly matching your working cURL request
  const headers: Record<string, string> = {
    'accept': '*/*',
    'accept-language': 'en-US,en;q=0.9',
    'content-type': 'application/json',
    'dnt': '1',
    'priority': 'u=1, i',
    'referer': referer,
    'sec-ch-ua': '"Not;A=Brand";v="99", "Microsoft Edge";v="139", "Chromium";v="139"',
    'sec-ch-ua-arch': '""',
    'sec-ch-ua-bitness': '"64"',
    'sec-ch-ua-form-factors': '"Desktop"',
    'sec-ch-ua-full-version': '"139.0.3405.111"',
    'sec-ch-ua-full-version-list': '"Not;A=Brand";v="99.0.0.0", "Microsoft Edge";v="139.0.3405.111", "Chromium";v="139.0.7258.139"',
    'sec-ch-ua-mobile': '?1',
    'sec-ch-ua-model': '"Nexus 5"',
    'sec-ch-ua-platform': '"Android"',
    'sec-ch-ua-platform-version': '"6.0"',
    'sec-ch-ua-wow64': '?0',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'user-agent': userAgent,
  };

  // Add cookies from the working request
  const cookieString = cookieManager.getCookieString();
  if (cookieString && cookieString.trim() !== '') {
    headers['cookie'] = cookieString;
  }

  // Sanitize all header values
  const sanitizedHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    const cleanValue = sanitizeHeaderValue(value);
    if (cleanValue && cleanValue.length > 0) {
      sanitizedHeaders[key.toLowerCase()] = cleanValue;
    }
  }

  return sanitizedHeaders;
}

/**
 * Create a more robust proxy agent
 */
function createProxyAgent(proxy: any): ProxyAgent | null {
  try {
    const proxyOptions: any = {
      uri: `http://${proxy.host}:${proxy.port}`,
      // Remove TLS options that might cause issues
      connect: {
        timeout: 30000,
      }
    };

    // Only add auth if properly configured
    if (proxy.username && proxy.password && 
        proxy.username.trim() !== '' && proxy.password.trim() !== '') {
      const cleanUsername = proxy.username.trim();
      const cleanPassword = proxy.password.trim();
      
      if (cleanUsername && cleanPassword) {
        proxyOptions.auth = `${cleanUsername}:${cleanPassword}`;
      }
    }

    const agent = new ProxyAgent(proxyOptions);
    
    logger.debug('Proxy agent created', {
      host: proxy.host,
      port: proxy.port,
      hasAuth: !!(proxy.username && proxy.password)
    });
    
    return agent;
  } catch (error) {
    logger.error('Failed to create proxy agent', {
      error: error instanceof Error ? error.message : 'Unknown error',
      proxy: { host: proxy.host, port: proxy.port }
    });
    return null;
  }
}

/**
 * Extract query from URL for header building
 */
function extractQueryFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.searchParams.get('query') || 'iphone';
  } catch {
    return 'iphone'; // fallback
  }
}

/**
 * Core scraping function with improved error handling
 */
export async function fetchPagedCompositeCards(
  url: string,
  options: ScrapeOptions = {}
): Promise<ScrapedResponse> {
  const startTime = Date.now();
  const normalizedUrl = normalizeToApiUrl(url);

  const {
    timeout = config.scraper.defaultTimeoutMs,
    maxRetries = config.scraper.maxRetries,
    proxyEnabled = config.proxy.enabled,
  } = options;

  let attempts = 0;

  const scrapeFn = async (): Promise<ScrapedResponse> => {
    attempts++;
    const requestStart = Date.now();
    let proxyAgent: ProxyAgent | null = null;

    try {
      // Extract query for proper referer building
      const query = extractQueryFromUrl(url);
      
      // Build headers exactly matching working cURL
      const headers = buildNaverHeaders(query);

      // Setup proxy if enabled
      if (proxyEnabled) {
        const proxy = proxyPool.getProxy();
        if (proxy?.host && proxy?.port) {
          logger.debug('Using proxy', {
            host: proxy.host,
            port: proxy.port,
            attempt: attempts
          });

          proxyAgent = createProxyAgent(proxy);
          if (!proxyAgent) {
            throw new Error('Failed to create proxy agent');
          }
        } else {
          logger.warn('Proxy enabled but no configuration found, using direct connection');
        }
      }

      // Add reasonable delay between requests
      if (attempts > 1) {
        const delayMs = Math.min(1000 * Math.pow(2, attempts - 2), 10000); // Exponential backoff, max 10s
        logger.debug(`Waiting ${delayMs}ms before retry ${attempts}`);
        await sleep(delayMs);
      } else {
        // Small initial delay
        await sleep(Math.random() * 2000 + 1000); // 1-3 seconds
      }

      // Build request options
      const requestOptions: any = {
        method: "GET",
        headers,
        headersTimeout: timeout,
        bodyTimeout: timeout,
        throwOnError: false,
        // Proxy-friendly options
        keepAliveTimeout: 4000,
        keepAliveMaxTimeout: 60000,
        maxRedirections: 3,
      };

      if (proxyAgent) {
        requestOptions.dispatcher = proxyAgent;
      }

      logger.debug('Making request', {
        url: normalizedUrl,
        attempt: attempts,
        proxyEnabled: !!proxyAgent,
        headerKeys: Object.keys(headers)
      });

      const response = await request(normalizedUrl, requestOptions);
      const latency = Date.now() - requestStart;

      logger.debug('Response received', {
        statusCode: response.statusCode,
        latency,
        contentType: response.headers['content-type'],
        contentLength: response.headers['content-length']
      });

      // Handle different status codes
      if (response.statusCode >= 400) {
        let errorBody = '';
        try {
          errorBody = await response.body.text();
          logger.debug('Error response body', { 
            statusCode: response.statusCode, 
            bodyPreview: errorBody.substring(0, 300) 
          });
        } catch (e) {
          errorBody = 'Could not read error response';
        }

        if (response.statusCode === 403) {
          throw new Error('Forbidden - Naver is blocking this request. Try different proxy or headers.');
        } else if (response.statusCode === 429) {
          throw new Error('Rate limited - too many requests. Increase delays between requests.');
        } else if (response.statusCode === 404) {
          throw new Error('API endpoint not found - check URL structure.');
        } else if (response.statusCode === 502 || response.statusCode === 503) {
          throw new Error('Naver server error - temporary issue, retry later.');
        }

        const error: any = new Error(`HTTP ${response.statusCode}: ${errorBody.substring(0, 200)}`);
        error.status = response.statusCode;
        error.latency = latency;
        throw error;
      }

      // Read and parse response
      let body: string;
      try {
        body = await response.body.text();
      } catch (bodyError) {
        throw new Error(`Failed to read response: ${bodyError instanceof Error ? bodyError.message : 'Unknown error'}`);
      }

      if (!body || body.trim().length === 0) {
        throw new Error('Empty response from Naver API');
      }

      // Parse JSON
      let jsonData: any;
      try {
        jsonData = JSON.parse(body);
      } catch (parseError) {
        logger.error('JSON parse error', {
          bodyLength: body.length,
          bodyStart: body.substring(0, 200),
          contentType: response.headers['content-type']
        });
        throw new Error('Invalid JSON response from Naver API');
      }

      // Validate response structure
      let validatedData;
      try {
        validatedData = NaverPagedCompositeCardsSchema.parse(jsonData);
      } catch (validationError) {
        logger.info('Using raw data due to schema validation failure', {
          error: validationError instanceof Error ? validationError.message.substring(0, 200) : 'Unknown error'
        });
        validatedData = jsonData;
      }

      const result: ScrapedResponse = {
        data: validatedData,
        metadata: {
          fetchedAt: new Date().toISOString(),
          sourceUrl: normalizedUrl,
          latencyMs: latency,
          attempts,
        },
      };

      metrics.recordSuccess(latency);
      logger.info('Scraping successful', {
        url: normalizedUrl,
        latency,
        attempts,
        dataSize: JSON.stringify(validatedData).length
      });

      return result;

    } catch (error: any) {
      const latency = error.latency || Date.now() - requestStart;
      
      logger.warn('Request failed', {
        url: normalizedUrl,
        attempt: attempts,
        error: error.message,
        latency,
        errorType: error.constructor.name
      });

      metrics.recordFailure(latency, error.status);

      // Enhanced error classification
      let enhancedError = error.message;
      
      if (error.code === 'UND_ERR_HEADERS_INVALID' || 
          error.message.includes('Invalid header value') ||
          error.message.includes('header value char')) {
        enhancedError = 'HTTP header error - proxy may be corrupting headers';
      } else if (error.code === 'ECONNREFUSED' || error.message.includes('ECONNREFUSED')) {
        enhancedError = 'Connection refused - proxy server may be down';
      } else if (error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
        enhancedError = 'Connection timeout - network or proxy too slow';
      } else if (error.code === 'ENOTFOUND' || error.message.includes('ENOTFOUND')) {
        enhancedError = 'DNS resolution failed - check proxy or network';
      } else if (error.message.includes('socket hang up')) {
        enhancedError = 'Connection dropped - server closed connection';
      } else if (error.message.includes('Forbidden')) {
        enhancedError = 'Access denied by Naver - blocked IP or bot detection';
      } else if (error.message.includes('CERT') || error.message.includes('certificate')) {
        enhancedError = 'SSL certificate error - proxy SSL issue';
      }

      throw new Error(enhancedError);

    } finally {
      // Clean up proxy agent
      if (proxyAgent && 'close' in proxyAgent) {
        try {
          await (proxyAgent as any).close();
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    }
  };

  try {
    const result = await circuitBreaker.execute(async () => {
      return await withRetry(scrapeFn, {
        maxRetries,
        baseDelayMs: 3000, // Higher base delay
        onRetry: (error, attempt) => {
          logger.info(`Retrying ${attempt + 1}/${maxRetries}`, {
            url: normalizedUrl,
            error: error.message,
            nextDelayMs: 3000 * Math.pow(2, attempt)
          });
        },
      });
    });

    return result;
  } catch (error: any) {
    if (error.message.includes("Circuit breaker is OPEN")) {
      metrics.recordCircuitBreakerTrip();
    }

    const finalError = new Error(`Scraping failed after ${attempts} attempts: ${error.message}`);
    logger.error('Scraping completely failed', {
      url: normalizedUrl,
      totalAttempts: attempts,
      finalError: error.message,
      duration: Date.now() - startTime
    });

    throw finalError;
  }
}

/**
 * Test connectivity with detailed diagnostics
 */
export async function testConnectivity(): Promise<{
  directConnection: boolean;
  proxyConnection: boolean;
  naverAccess: boolean;
  error?: string;
  details: any;
}> {
  const results = {
    directConnection: false,
    proxyConnection: false,
    naverAccess: false,
    details: {} as any
  };

  try {
    // Test direct connection
    try {
      const directResponse = await request('https://httpbin.org/ip', {
        method: 'GET',
        headersTimeout: 10000,
        bodyTimeout: 10000,
        throwOnError: false
      });
      
      if (directResponse.statusCode === 200) {
        results.directConnection = true;
        const body = await directResponse.body.text();
        const data = JSON.parse(body);
        results.details.directIP = data.origin;
      }
    } catch (e) {
      results.details.directError = e instanceof Error ? e.message : 'Unknown error';
    }

    // Test proxy connection
    const proxy = proxyPool.getProxy();
    if (proxy) {
      try {
        const proxyAgent = createProxyAgent(proxy);
        if (proxyAgent) {
          const proxyResponse = await request('https://httpbin.org/ip', {
            dispatcher: proxyAgent,
            method: 'GET',
            headersTimeout: 10000,
            bodyTimeout: 10000,
            throwOnError: false
          });

          if (proxyResponse.statusCode === 200) {
            results.proxyConnection = true;
            const body = await proxyResponse.body.text();
            const data = JSON.parse(body);
            results.details.proxyIP = data.origin;
          }

          await (proxyAgent as any).close();
        }
      } catch (e) {
        results.details.proxyError = e instanceof Error ? e.message : 'Unknown error';
      }
    } else {
      results.details.proxyError = 'No proxy configuration found';
    }

    // Test Naver access
    if (results.proxyConnection || results.directConnection) {
      try {
        const testResult = await fetchPagedCompositeCards(
          'https://search.shopping.naver.com/ns/search?query=test',
          { timeout: 15000, maxRetries: 1 }
        );
        
        results.naverAccess = true;
        results.details.naverLatency = testResult.metadata.latencyMs;
        results.details.naverDataReceived = !!testResult.data;
      } catch (e) {
        results.details.naverError = e instanceof Error ? e.message : 'Unknown error';
      }
    }

    return results;
  } catch (error) {
    return {
      ...results,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Export other functions
export async function batchFetchPagedCompositeCards(
  urls: string[],
  options: ScrapeOptions & { concurrency?: number } = {}
): Promise<Array<ScrapedResponse | Error>> {
  const {
    concurrency = Math.min(config.scraper.maxConcurrentRequests, 2), // Lower concurrency for stability
    ...scrapeOptions
  } = options;

  let activeRequests = 0;
  const results: Array<ScrapedResponse | Error> = [];

  const processUrl = async (url: string, index: number): Promise<void> => {
    while (activeRequests >= concurrency) {
      await sleep(2000); // Wait longer between batch requests
    }

    activeRequests++;

    try {
      // Add random delay for each request in batch
      await sleep(Math.random() * 3000 + 2000); // 2-5 seconds
      const result = await fetchPagedCompositeCards(url, scrapeOptions);
      results[index] = result;
    } catch (error) {
      results[index] = error as Error;
    } finally {
      activeRequests--;
    }
  };

  const promises = urls.map((url, index) => processUrl(url, index));
  await Promise.all(promises);

  return results;
}

export function getCircuitBreakerStatus() {
  return circuitBreaker.getState();
}

export function resetCircuitBreaker() {
  circuitBreaker.reset();
}