import { z } from 'zod';

// Naver API Response Schema
export const NaverProductSchema = z.object({
  id: z.string(),
  title: z.string(),
  price: z.number().optional(),
  imageUrl: z.string().optional(),
  mallName: z.string().optional(),
  reviewCount: z.number().optional(),
  rating: z.number().optional(),
  url: z.string().optional(),
});

export const NaverPagedCompositeCardsSchema = z.object({
  products: z.array(NaverProductSchema).optional(),
  totalCount: z.number().optional(),
  cursor: z.string().optional(),
  hasNext: z.boolean().optional(),
  // Allow additional fields that Naver might include
}).passthrough();

export type NaverProduct = z.infer<typeof NaverProductSchema>;
export type NaverPagedCompositeCards = z.infer<typeof NaverPagedCompositeCardsSchema>;

// Internal Types
export interface ScrapedResponse {
  data: NaverPagedCompositeCards;
  metadata: {
    fetchedAt: string;
    sourceUrl: string;
    latencyMs: number;
    attempts: number;
  };
}

export interface ScrapeOptions {
  timeout?: number;
  maxRetries?: number;
  proxyEnabled?: boolean;
  userAgent?: string;
  customHeaders?: Record<string, string>;
}

export interface ProxyConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
}

export interface MetricsData {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatencyMs: number;
  p95LatencyMs: number;
  errorsByStatus: Record<string, number>;
  circuitBreakerTrips: number;
  lastResetAt: string;
}

// URL parsing types
export interface ParsedNaverUrl {
  baseUrl: string;
  query: string;
  cursor?: string;
  pageSize?: number;
  additionalParams: Record<string, string>;
}

// Request headers template
export interface RequestFingerprint {
  userAgent: string;
  acceptLanguage: string;
  acceptEncoding: string;
  secChUa: string;
  secChUaMobile: string;
  secChUaPlatform: string;
  secFetchDest: string;
  secFetchMode: string;
  secFetchSite: string;
}