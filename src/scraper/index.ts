import got, { Response } from 'got';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { buildNaverHeaders } from './headers.js';

const MAX_RETRIES = Number(process.env.MAX_RETRIES ?? 6);
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS ?? 60000); // Timeout diperpanjang
const MIN_DELAY_MS = Number(process.env.MIN_DELAY_MS ?? 2000);  // Delay awal diperpanjang
const MAX_DELAY_MS = Number(process.env.MAX_DELAY_MS ?? 5000);  // Delay maksimal diperpanjang

function sleep(ms: number) { return new Promise(res => setTimeout(res, ms)); }
function jitter(min = MIN_DELAY_MS, max = MAX_DELAY_MS) {
  return Math.floor(min + Math.random() * (max - min));
}

function buildHttpsProxyAgent(): HttpsProxyAgent<string> | undefined {
  if (!(process.env.PROXY_ROTATION === 'on' && process.env.FORCE_DIRECT !== '1')) return undefined;
  const { PROXY_HOST, PROXY_PORT, PROXY_USERNAME, PROXY_PASSWORD } = process.env;
  if (!PROXY_HOST || !PROXY_PORT || !PROXY_USERNAME || !PROXY_PASSWORD) return undefined;

  const proxyUrl = `http://${encodeURIComponent(PROXY_USERNAME)}:${encodeURIComponent(PROXY_PASSWORD)}@${PROXY_HOST}:${PROXY_PORT}`;
  return new HttpsProxyAgent(proxyUrl);
}

// URL normalizer
export function toPagedCompositeUrl(inputUrl: string): string {
  try {
    const u = new URL(inputUrl);
    if (u.pathname.includes('/ns/v1/search/paged-composite-cards')) return inputUrl;
    const query = u.searchParams.get('query') || 'iphone';
    const params = new URLSearchParams({
      cursor: '1',
      pageSize: '50',
      query,
      searchMethod: 'all.basic',
      isFreshCategory: 'false',
      isOriginalQuerySearch: 'false',
      isCatalogDiversifyOff: 'false',
      listPage: '1',
      hasMoreAd: 'true',
      hiddenNonProductCard: 'true'
    });
    return `https://search.shopping.naver.com/ns/v1/search/paged-composite-cards?${params.toString()}`;
  } catch {
    return inputUrl;
  }
}

// Retry fetch with more detailed error handling
export async function fetchPagedCompositeCards(inputUrl: string) {
  const url = toPagedCompositeUrl(inputUrl);
  const query = new URL(url).searchParams.get('query') || 'iphone';
  let headersBase = buildNaverHeaders(query);

  // Add cookies if available in .env
  const cookie = process.env.NAVER_COOKIE?.trim();
  if (cookie) {
    headersBase['Cookie'] = cookie;
  }

  const httpsAgent = buildHttpsProxyAgent();
  const allowDirect = process.env.ALLOW_DEBUG_DIRECT === '1';

  // Retry loop
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      // Rotate UA for anti-bot retries
      if (attempt > 0) {
        process.env.NAVER_MOBILE_UA = process.env.NAVER_MOBILE_UA === '1' ? '0' : '1';
        headersBase = buildNaverHeaders(query);
      }

      const client = got.extend({
        agent: httpsAgent ? { https: httpsAgent } : undefined,  // Use proxy agent if available
        headers: headersBase,
        http2: false,
        decompress: true,
        throwHttpErrors: false,
        timeout: { request: REQUEST_TIMEOUT_MS },
        dnsLookupIpVersion: 4 as const
      });

      const res = await client.get(url, { responseType: 'text' });
      const status = res.statusCode ?? 0;

      // SUCCESS
      if (status >= 200 && status < 300) {
        return JSON.parse(res.body);
      }

      // Handle anti-bot responses (418/403/429)
      if ([418, 403, 429].includes(status)) {
        console.log(`Anti-bot detected, retrying... HTTP ${status}`);
        await sleep(jitter(1200, 3500));  // Retry with longer delay
        continue;
      }

      // Handle proxy gateway errors (407/502/503/504)
      if (isBadProxyResponse(res)) {
        console.log(`Proxy error detected, retrying... HTTP ${status}`);
        await sleep(jitter());
        continue;
      }

      throw new Error(`HTTP ${status}`);
    } catch (e: any) {
      console.log(`Error on attempt ${attempt + 1}/${MAX_RETRIES}:`, e.message);

      // Transport errors (EPROTO, ECONNRESET, ETIMEDOUT, etc.)
      if (isTransportError(e)) {
        console.log('Transport error, retrying...');
        await sleep(jitter());
        continue;
      }

      // Direct fallback if allowed
      if (attempt === MAX_RETRIES - 1 && allowDirect) {
        try {
          console.log("Falling back to direct request...");
          const clientDirect = got.extend({
            http2: false,
            headers: buildNaverHeaders(query),
            decompress: true,
            throwHttpErrors: false,
            timeout: { request: REQUEST_TIMEOUT_MS },
            dnsLookupIpVersion: 4 as const
          });
          const res = await clientDirect.get(url, { responseType: 'text' });
          if ((res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300) {
            return JSON.parse(res.body);
          }
        } catch (err) {
          console.log("Direct fallback failed:", (err instanceof Error ? err.message : String(err)));
        }
      }

      // If no success after all retries, throw error
      if (attempt === MAX_RETRIES - 1) throw e;
    }
    await sleep(jitter());
  }

  throw new Error(`Scraping failed after ${MAX_RETRIES} attempts`);
}

// Helper functions for proxy and transport errors
function isTransportError(e: any): boolean {
  const code = (e?.code || '').toString();
  const msg = (e?.message || '').toLowerCase();
  return ['EPROTO','ECONNRESET','ETIMEDOUT','UND_ERR_SOCKET'].includes(code)
      || msg.includes('ssl3_get_record')
      || msg.includes('wrong version number')
      || msg.includes('socket hang up');
}

function isBadProxyResponse(res?: Response<string>) {
  return !!res && [407,502,503,504].includes(res.statusCode ?? 0);
}
