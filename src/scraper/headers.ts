// Safe, browser-like headers for Naver
export function buildNaverHeaders(query = 'iphone'): Record<string, string> {
  const ua =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

  return {
    'User-Agent': ua,
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'ko,en;q=0.9',
    'Referer': `https://search.shopping.naver.com/ns/search?query=${encodeURIComponent(query)}`,
    'Origin': 'https://search.shopping.naver.com',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
    // NOTE: no Content-Type for GET, no sec-ch-ua*, no priority/sec-fetch-*.
  };
}
