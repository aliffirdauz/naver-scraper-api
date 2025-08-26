import got from 'got';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { HttpProxyAgent } from 'http-proxy-agent';
import { buildNaverHeaders } from './headers.js';

const MAX_RETRIES = Number(process.env.MAX_RETRIES ?? 4);
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS ?? 30000);
const MIN_DELAY_MS = Number(process.env.MIN_DELAY_MS ?? 500);
const MAX_DELAY_MS = Number(process.env.MAX_DELAY_MS ?? 2500);

function sleep(ms: number) { return new Promise(res => setTimeout(res, ms)); }
function jitter(min = MIN_DELAY_MS, max = MAX_DELAY_MS) {
  return Math.floor(min + Math.random() * (max - min));
}

function buildHttpsProxyAgent() {
  const on = process.env.PROXY_ROTATION === 'on' && process.env.FORCE_DIRECT !== '1';
  const host = process.env.PROXY_HOST;
  const port = process.env.PROXY_PORT;
  const user = process.env.PROXY_USERNAME;
  const pass = process.env.PROXY_PASSWORD;
  if (!on || !host || !port) return undefined;

  const auth = user && pass ? `${encodeURIComponent(user)}:${encodeURIComponent(pass)}@` : '';
  // PROXY **HTTP**, jadi pakai skema http:// (bukan https://)
  const proxyUrl = `http://${auth}${host}:${port}`;

  // HttpsProxyAgent akan membuat HTTP CONNECT tunnel untuk target HTTPS
  return new HttpsProxyAgent(proxyUrl);
}

/** Ubah URL halaman ke API paged-composite-cards */
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

  const httpsAgent = buildHttpsProxyAgent();

  const client = got.extend({
    agent: httpsAgent ? { https: httpsAgent } : undefined, // <-- penting: hanya https
    headers,
    http2: false,                // hindari ALPN/H2 dulu
    decompress: true,
    throwHttpErrors: false,
    timeout: { request: Number(process.env.REQUEST_TIMEOUT_MS ?? 30000) },
    dnsLookupIpVersion: 4 as const
  });

  let lastErr: any;
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      // Variasikan UA per attempt kecil2an (hindari set header object baru hard)
      if (i > 0) {
        // flip mobile/desktop kecil-kecilan saat retry
        process.env.NAVER_MOBILE_UA = process.env.NAVER_MOBILE_UA === '1' ? '0' : '1';
        Object.assign(headers, buildNaverHeaders(query));
      }

      const res = await client.get(url, { responseType: 'text', headers });
      const code = res.statusCode ?? 0;

      if (code >= 200 && code < 300) {
        return JSON.parse(res.body);
      }

      // 418/403/429 → anggap anti-bot: tunda lebih lama sebelum retry
      if ([418, 403, 429].includes(code)) {
        lastErr = new Error(`HTTP ${code}`);
        await sleep(jitter(1200, 3500));
        continue;
      }

      // Lainnya → retry ringan
      lastErr = new Error(`HTTP ${code}`);
      await sleep(jitter());
    } catch (e) {
      lastErr = e;
      await sleep(jitter());
    }
  }
  throw lastErr ?? new Error('Unknown error');
}
