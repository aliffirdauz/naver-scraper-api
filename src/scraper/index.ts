import { request } from "undici";
import { ProxyAgent } from "undici";
import {
  generateFingerprint,
  fingerprintToHeaders,
  shuffleHeaders,
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
 * Core scraping function - handles a single request to Naver's paged-composite-cards API
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
    customHeaders = {},
  } = options;

  let attempts = 0;

  const scrapeFn = async (): Promise<ScrapedResponse> => {
    attempts++;
    const requestStart = Date.now();

    // Generate fresh fingerprint for each attempt
    const fingerprint = generateFingerprint();
    let headers = { ...fingerprintToHeaders(fingerprint), ...customHeaders };
    headers = shuffleHeaders(headers);

    // Setup proxy if enabled
    let dispatcher: ProxyAgent | undefined;
    const proxy = proxyEnabled ? proxyPool.getProxy() : null;

    if (proxy?.host && proxy?.port) {
      const proxyOpts: any = {
        uri: `http://${proxy.host}:${proxy.port}`,
        requestTls: { rejectUnauthorized: false },
      };
      // Tambahkan auth hanya kalau lengkap
      if (proxy.username && proxy.password) {
        proxyOpts.auth = `${proxy.username}:${proxy.password}`;
      }

      dispatcher = new ProxyAgent(proxyOpts);
    }

    try {
      // Add random delay to mimic human behavior
      const delayMs =
        Math.random() *
          (config.scraper.maxDelayMs - config.scraper.minDelayMs) +
        config.scraper.minDelayMs;
      await sleep(delayMs, 0.1);

      const requestOptions: any = {
        method: "GET",
        headers,
        headersTimeout: timeout,
        bodyTimeout: timeout,
        throwOnError: false, // Handle errors manually
      };
      if (dispatcher) {
        requestOptions.dispatcher = dispatcher;
      }

      const response = await request(normalizedUrl, requestOptions);

      const latency = Date.now() - requestStart;

      // Check response status
      if (response.statusCode >= 400) {
        const error: any = new Error(
          `HTTP ${response.statusCode}: ${response.body}`
        );
        error.status = response.statusCode;
        error.latency = latency;
        throw error;
      }

      // Parse response body
      const body = await response.body.text();
      let jsonData;

      try {
        jsonData = JSON.parse(body);
      } catch (parseError) {
        throw new Error("Invalid JSON response from Naver API");
      }

      // Validate response structure
      const validatedData = NaverPagedCompositeCardsSchema.parse(jsonData);

      const result: ScrapedResponse = {
        data: validatedData,
        metadata: {
          fetchedAt: new Date().toISOString(),
          sourceUrl: normalizedUrl,
          latencyMs: latency,
          attempts,
        },
      };

      // Record success metrics
      metrics.recordSuccess(latency);

      return result;
    } catch (error: any) {
      const latency = error.latency || Date.now() - requestStart;

      // Record failure metrics
      metrics.recordFailure(latency, error.status);

      throw error;
    } finally {
      // Cleanup dispatcher
      if (dispatcher && "close" in dispatcher) {
        await (dispatcher as any).close();
      }
    }
  };

  try {
    // Execute with circuit breaker protection
    const result = await circuitBreaker.execute(async () => {
      return await withRetry(scrapeFn, {
        maxRetries,
        baseDelayMs: 1000,
        onRetry: (error, attempt) => {
          console.warn(
            `Retry attempt ${attempt + 1}/${maxRetries} for ${normalizedUrl}: ${
              error.message
            }`
          );
        },
      });
    });

    return result;
  } catch (error: any) {
    if (error.message.includes("Circuit breaker is OPEN")) {
      metrics.recordCircuitBreakerTrip();
    }

    throw new Error(
      `Scraping failed after ${attempts} attempts: ${error.message}`
    );
  }
}

/**
 * Batch scraping with concurrency control
 */
export async function batchFetchPagedCompositeCards(
  urls: string[],
  options: ScrapeOptions & { concurrency?: number } = {}
): Promise<Array<ScrapedResponse | Error>> {
  const {
    concurrency = config.scraper.maxConcurrentRequests,
    ...scrapeOptions
  } = options;

  // Simple semaphore for concurrency control
  let activeRequests = 0;
  const results: Array<ScrapedResponse | Error> = [];

  const processUrl = async (url: string, index: number): Promise<void> => {
    while (activeRequests >= concurrency) {
      await sleep(100); // Wait for slot to open
    }

    activeRequests++;

    try {
      const result = await fetchPagedCompositeCards(url, scrapeOptions);
      results[index] = result;
    } catch (error) {
      results[index] = error as Error;
    } finally {
      activeRequests--;
    }
  };

  // Start all requests
  const promises = urls.map((url, index) => processUrl(url, index));

  await Promise.all(promises);

  return results;
}

/**
 * Get circuit breaker status
 */
export function getCircuitBreakerStatus() {
  return circuitBreaker.getState();
}

/**
 * Reset circuit breaker (useful for recovery)
 */
export function resetCircuitBreaker() {
  circuitBreaker.reset();
}
