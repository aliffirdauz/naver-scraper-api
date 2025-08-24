/**
 * Cookie management for Naver Shopping
 * Based on your captured request cookies
 */

interface CookieTemplate {
  name: string;
  value: string;
  required: boolean;
  generateRandom?: () => string;
}

// Essential cookies that Naver requires
const ESSENTIAL_COOKIES: CookieTemplate[] = [
  {
    name: 'NAC',
    value: 'l2n3BcQFQesiA', // This might need to be dynamic
    required: true,
    generateRandom: () => generateRandomString(13) // Base64-like string
  },
  {
    name: 'NNB',
    value: 'IHI3QG5SW2VGQ', // Browser fingerprint
    required: true,
    generateRandom: () => generateRandomString(15)
  },
  {
    name: 'RELATED_PRODUCT',
    value: 'ON',
    required: false
  },
  {
    name: 'SENTRY_REPORTING',
    value: '2',
    required: false
  }
];

// Session cookies that change frequently
const SESSION_COOKIES: CookieTemplate[] = [
  {
    name: 'nstore_session',
    value: '', // Will be generated
    required: true,
    generateRandom: () => generateRandomString(24)
  },
  {
    name: 'nstore_pagesession', 
    value: '', // Will be generated
    required: true,
    generateRandom: () => generateRandomString(20) + '-' + Date.now().toString().slice(-6)
  },
  {
    name: 'SRT30',
    value: '', // Timestamp
    required: false,
    generateRandom: () => (Date.now() + Math.random() * 86400000).toString().split('.')[0] // +24h random
  },
  {
    name: 'SRT5',
    value: '', // Timestamp
    required: false,
    generateRandom: () => (Date.now() + Math.random() * 86400000).toString().split('.')[0]
  }
];

/**
 * Generate random string for cookie values
 */
function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate random hex string
 */
function generateRandomHex(length: number): string {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Cookie manager class
 */
export class CookieManager {
  private cookies: Map<string, string> = new Map();
  
  constructor() {
    this.initializeCookies();
  }
  
  /**
   * Initialize with default cookie set
   */
  private initializeCookies(): void {
    // Set essential cookies
    ESSENTIAL_COOKIES.forEach(cookie => {
      const value = cookie.generateRandom ? cookie.generateRandom() : cookie.value;
      this.cookies.set(cookie.name, value);
    });
    
    // Set session cookies
    SESSION_COOKIES.forEach(cookie => {
      const value = cookie.generateRandom ? cookie.generateRandom() : cookie.value;
      this.cookies.set(cookie.name, value);
    });
    
    // Set BUC (seems to be an encrypted session token)
    this.cookies.set('BUC', this.generateBUC());
  }
  
  /**
   * Generate BUC cookie (Base64 encoded session data)
   */
  private generateBUC(): string {
    // Generate a realistic looking BUC token
    const randomData = generateRandomString(32);
    return Buffer.from(randomData).toString('base64').replace(/=/g, '');
  }
  
  /**
   * Get cookie string for HTTP request
   */
  getCookieString(): string {
    const cookiePairs: string[] = [];
    
    // Add cookies in a realistic order
    const cookieOrder = [
      'NAC', 'nstore_session', 'sus_val', 'X-Wtm-Cpt-Tk',
      'RELATED_PRODUCT', 'SRT30', 'SRT5', 'NNB', 'SENTRY_REPORTING',
      'nstore_pagesession', 'OEP_CONFIG', 'BUC'
    ];
    
    cookieOrder.forEach(name => {
      if (this.cookies.has(name)) {
        cookiePairs.push(`${name}=${this.cookies.get(name)}`);
      }
    });
    
    // Add any remaining cookies
    this.cookies.forEach((value, name) => {
      if (!cookieOrder.includes(name)) {
        cookiePairs.push(`${name}=${value}`);
      }
    });
    
    return cookiePairs.join('; ');
  }
  
  /**
   * Set a specific cookie
   */
  setCookie(name: string, value: string): void {
    this.cookies.set(name, value);
  }
  
  /**
   * Get a specific cookie
   */
  getCookie(name: string): string | undefined {
    return this.cookies.get(name);
  }
  
  /**
   * Refresh session cookies (call this periodically)
   */
  refreshSession(): void {
    SESSION_COOKIES.forEach(cookie => {
      if (cookie.generateRandom) {
        this.cookies.set(cookie.name, cookie.generateRandom());
      }
    });
    
    // Refresh BUC token
    this.cookies.set('BUC', this.generateBUC());
  }
  
  /**
   * Clone this cookie manager for parallel requests
   */
  clone(): CookieManager {
    const cloned = new CookieManager();
    cloned.cookies.clear();
    
    this.cookies.forEach((value, name) => {
      cloned.cookies.set(name, value);
    });
    
    return cloned;
  }
  
  /**
   * Get all cookies as object
   */
  getAllCookies(): Record<string, string> {
    const result: Record<string, string> = {};
    this.cookies.forEach((value, name) => {
      result[name] = value;
    });
    return result;
  }
}

// Global cookie manager instance
export const cookieManager = new CookieManager();

/**
 * Periodically refresh session cookies (every 10 minutes)
 */
setInterval(() => {
  cookieManager.refreshSession();
}, 10 * 60 * 1000);