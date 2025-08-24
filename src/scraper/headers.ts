import { RequestFingerprint } from './types.js';

// User Agent pool - based on real Naver traffic patterns
const USER_AGENTS = [
  // Desktop Chrome
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
  // Desktop Edge
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36 Edg/139.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36 Edg/139.0.0.0',
  // Mobile (like your captured request)
  'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36 Edg/139.0.0.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
];

// Accept-Language - mix Korean and English based on real patterns
const ACCEPT_LANGUAGES = [
  'en-US,en;q=0.9', // Your captured one
  'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
  'ko-KR,ko;q=0.9,en;q=0.8',
  'en-US,en;q=0.9,ko;q=0.8',
  'ko;q=0.9,en-US;q=0.8,en;q=0.7'
];

// sec-ch-ua variations matching real browsers
const SEC_CH_UA_VARIANTS = [
  '"Not;A=Brand";v="99", "Microsoft Edge";v="139", "Chromium";v="139"', // Your captured one
  '"Not_A Brand";v="8", "Chromium";v="139", "Microsoft Edge";v="139"',
  '"Google Chrome";v="139", "Chromium";v="139", "Not_A Brand";v="24"',
  '"Chromium";v="139", "Not_A Brand";v="8", "Google Chrome";v="139"'
];

// Platform variations
const PLATFORMS = [
  '"Android"', // Your captured one
  '"Windows"',
  '"macOS"',
  '"Linux"'
];

// Mobile detection patterns
const MOBILE_PATTERNS = [
  '?1', // Your captured one (mobile)
  '?0'  // Desktop
];

/**
 * Generate a realistic browser fingerprint for anti-detection
 * Each call returns a different but realistic combination
 */
export function generateFingerprint(): RequestFingerprint {
  const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  
  // Detect device type from user agent
  const isMobile = userAgent.includes('Mobile') || userAgent.includes('iPhone') || userAgent.includes('Android');
  const isEdge = userAgent.includes('Edg/');
  const isChrome = userAgent.includes('Chrome') && !userAgent.includes('Firefox');
  const isAndroid = userAgent.includes('Android');
  const isIPhone = userAgent.includes('iPhone');
  const isWindows = userAgent.includes('Windows');
  const isMac = userAgent.includes('Mac');
  
  // Select appropriate sec-ch-ua based on browser
  let secChUa = '""';
  if (isChrome || isEdge) {
    secChUa = SEC_CH_UA_VARIANTS[Math.floor(Math.random() * SEC_CH_UA_VARIANTS.length)];
  }
  
  // Select appropriate platform
  let platform = '"Windows"';
  if (isAndroid) platform = '"Android"';
  else if (isMac || isIPhone) platform = '"macOS"';
  else if (userAgent.includes('Linux')) platform = '"Linux"';
  
  return {
    userAgent,
    acceptLanguage: ACCEPT_LANGUAGES[Math.floor(Math.random() * ACCEPT_LANGUAGES.length)],
    acceptEncoding: 'gzip, deflate, br',
    secChUa,
    secChUaMobile: isMobile ? '?1' : '?0',
    secChUaPlatform: platform,
    secFetchDest: 'empty',
    secFetchMode: 'cors',
    secFetchSite: 'same-origin'
  };
}

/**
 * Convert fingerprint to HTTP headers object
 * Based on your captured Naver request
 */
export function fingerprintToHeaders(fingerprint: RequestFingerprint): Record<string, string> {
  return {
    'User-Agent': fingerprint.userAgent,
    'Accept': '*/*', // Exactly as captured from Naver
    'Accept-Language': fingerprint.acceptLanguage,
    'Accept-Encoding': fingerprint.acceptEncoding,
    'Content-Type': 'application/json', // Critical for Naver API
    'Sec-Ch-Ua': fingerprint.secChUa,
    'Sec-Ch-Ua-Mobile': fingerprint.secChUaMobile,
    'Sec-Ch-Ua-Platform': fingerprint.secChUaPlatform,
    'Sec-Fetch-Dest': fingerprint.secFetchDest,
    'Sec-Fetch-Mode': fingerprint.secFetchMode,
    'Sec-Fetch-Site': fingerprint.secFetchSite,
    'DNT': '1', // Do Not Track as in your capture
    'Priority': 'u=1, i', // Chrome priority hints
    'Referer': 'https://search.shopping.naver.com/ns/search', // Will be updated with actual query
    // Note: Cookies will be handled separately
  };
}

/**
 * Add some randomization to header order (some sites check this)
 */
export function shuffleHeaders(headers: Record<string, string>): Record<string, string> {
  const entries = Object.entries(headers);
  const shuffled: Record<string, string> = {};
  
  // Keep essential headers first
  const essentialFirst = ['Host', 'User-Agent', 'Accept'];
  
  essentialFirst.forEach(key => {
    if (headers[key]) {
      shuffled[key] = headers[key];
    }
  });
  
  // Add remaining headers in random order
  entries
    .filter(([key]) => !essentialFirst.includes(key))
    .sort(() => Math.random() - 0.5)
    .forEach(([key, value]) => {
      shuffled[key] = value;
    });
    
  return shuffled;
}