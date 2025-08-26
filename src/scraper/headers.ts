// src/scraper/headers.ts
function sanitize(value: string): string {
  return value.replace(/[\u0000-\u001F\u007F]/g, ' ');
}

const DESKTOP_UA = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
];

const MOBILE_UA = [
  'Mozilla/5.0 (Linux; Android 12; SM-G988N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36'
];

function pick<T>(arr: T[]) { return arr[Math.floor(Math.random() * arr.length)]; }

export function buildNaverHeaders(query = 'iphone'): Record<string, string> {
  const mobile = process.env.NAVER_MOBILE_UA === '1';
  const ua = pick(mobile ? MOBILE_UA : DESKTOP_UA);

  const headers: Record<string, string> = {
    'User-Agent': ua,
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'ko,en;q=0.9',
    'Referer': `https://search.shopping.naver.com/ns/search?query=${encodeURIComponent(query)}`,
    'Origin': 'https://search.shopping.naver.com',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
  };

  if (process.env.ADD_SEC_FETCH === '1') {
    // Nilai aman untuk request fetch CORS dari origin yang sama
    headers['Sec-Fetch-Dest'] = 'empty';
    headers['Sec-Fetch-Mode'] = 'cors';
    headers['Sec-Fetch-Site'] = 'same-origin';
  }

  const cookie = (process.env.NAVER_COOKIE || '').trim();
  if (cookie) headers['Cookie'] = sanitize(cookie);

  // Final sanitize
  for (const k of Object.keys(headers)) headers[k] = sanitize(headers[k]);

  return headers;
}
