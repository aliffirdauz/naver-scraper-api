import got from 'got';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { HttpProxyAgent } from 'http-proxy-agent';
import { buildNaverHeaders } from './headers.js';

const MAX_RETRIES = Number(process.env.MAX_RETRIES ?? 3);
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS ?? 30000);
const MIN_DELAY_MS = Number(process.env.MIN_DELAY_MS ?? 500);
const MAX_DELAY_MS = Number(process.env.MAX_DELAY_MS ?? 1500);

function sleep(ms: number) { return new Promise(res => setTimeout(res, ms)); }
function jitter(minMs = MIN_DELAY_MS, maxMs = MAX_DELAY_MS) {
  return Math.floor(minMs + Math.random() * (maxMs - minMs));
}

function buildProxyAgents() {
  const on = process.env.PROXY_ROTATION === 'on' && process.env.FORCE_DIRECT !== '1';
  const host = process.env.PROXY_HOST;
  const port = process.env.PROXY_PORT;
  const user = process.env.PROXY_USERNAME;
  const pass = process.env.PROXY_PASSWORD;
  if (!on || !host || !port) return undefined;

  const auth = user && pass ? `${encodeURIComponent(user)}:${encodeURIComponent(pass)}@` : '';
  const proxyUrl = `http://${auth}${host}:${port}`;
  return {
    https: new HttpsProxyAgent(proxyUrl),
    http: new HttpProxyAgent(proxyUrl)
  };
}

/** Convert page URL (?query=...) to the paged-composite-cards API URL */
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

export async function fetchPagedCompositeCards(inputUrl: string) {
  const url = toPagedCompositeUrl(inputUrl);
  const query = new URL(url).searchParams.get('query') || 'iphone';
  const headers = buildNaverHeaders(query);

  const agents = buildProxyAgents();

  const client = got.extend({
    agent: agents,               // undefined = direct
    headers,
    http2: false,                // force HTTP/1.1 (simpler with proxies)
    decompress: true,
    throwHttpErrors: false,
    timeout: { request: REQUEST_TIMEOUT_MS },
    dnsLookupIpVersion: 4 as const
  });

  let lastErr: any;
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const res = await client.get(url, { responseType: 'text' }); // Response<string>
      if ((res.statusCode ?? 0) >= 400) {
        lastErr = new Error(`HTTP ${res.statusCode}`);
      } else {
        return JSON.parse(res.body);
      }
    } catch (e) {
      lastErr = e;
    }
    await sleep(jitter());
  }
  throw lastErr ?? new Error('Unknown error');
}
