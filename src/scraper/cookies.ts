/**
 * Cookie management for Naver Shopping
 * Based on your working cURL request cookies
 */

interface CookieTemplate {
  name: string;
  value: string;
  required: boolean;
  generateRandom?: () => string;
}

/**
 * Generate random string matching Naver's patterns
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
 * Generate timestamp-based value
 */
function generateTimestamp(): string {
  return Math.floor(Date.now() / 1000 + Math.random() * 86400).toString();
}

/**
 * Generate realistic session token
 */
function generateSessionToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let result = '';
  for (let i = 0; i < 24; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate page session token
 */
function generatePageSession(): string {
  const base = generateRandomString(16);
  const timestamp = Date.now().toString().slice(-6);
  return `${base}-${timestamp}`;
}

/**
 * Generate BUC token (Base64-like encrypted session)
 */
function generateBUC(): string {
  // Generate a realistic BUC token similar to the working one
  const randomPart1 = generateRandomString(8);
  const randomPart2 = generateRandomString(16);
  const randomPart3 = generateRandomString(32);
  const combined = `${randomPart1}_${randomPart2}_${randomPart3}`;
  
  return Buffer.from(combined).toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Generate X-Wtm-Cpt-Tk token (Complex tracking token)
 */
function generateXWtmCptTk(): string {
  // This is a complex token, we'll generate something similar to the working one
  const segments = [
    generateRandomString(32),
    generateRandomString(16),
    generateRandomString(8),
    generateRandomString(24)
  ];
  
  return segments.join('_').replace(/[_]/g, () => {
    const replacements = ['_', '-', ''];
    return replacements[Math.floor(Math.random() * replacements.length)];
  });
}

/**
 * Cookie manager class using exact working patterns
 */
export class CookieManager {
  private cookies: Map<string, string> = new Map();
  
  constructor() {
    this.initializeWithWorkingCookies();
  }
  
  /**
   * Initialize with cookies based on your working cURL request
   */
  private initializeWithWorkingCookies(): void {
    // Set cookies in the same order as your working cURL request
    this.cookies.set('NAC', 'l2n3BcQFQesiA'); // Keep the working value initially
    this.cookies.set('nstore_session', this.generateNstoreSession());
    this.cookies.set('NNB', 'IHI3QG5SW2VGQ'); // Keep the working value initially
    this.cookies.set('X-Wtm-Cpt-Tk', generateXWtmCptTk());
    this.cookies.set('nstore_pagesession', generatePageSession());
    this.cookies.set('RELATED_PRODUCT', 'ON');
    this.cookies.set('SRT30', generateTimestamp());
    this.cookies.set('SRT5', generateTimestamp());
    this.cookies.set('BUC', generateBUC());
  }
  
  /**
   * Generate nstore_session similar to working pattern
   */
  private generateNstoreSession(): string {
    // Pattern: EIqwRigKNRfjo29nXqi40vZy (24 chars, mixed case)
    return generateRandomString(24);
  }
  
  /**
   * Get cookie string exactly as in working cURL request
   */
  getCookieString(): string {
    // Return cookies in the exact order from your working cURL
    const cookieOrder = [
      'NAC',
      'nstore_session', 
      'NNB',
      'X-Wtm-Cpt-Tk',
      'nstore_pagesession',
      'RELATED_PRODUCT',
      'SRT30',
      'SRT5',
      'BUC'
    ];
    
    const cookiePairs: string[] = [];
    
    cookieOrder.forEach(name => {
      if (this.cookies.has(name)) {
        const value = this.cookies.get(name);
        if (value) {
          cookiePairs.push(`${name}=${value}`);
        }
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
   * Refresh session cookies periodically
   */
  refreshSession(): void {
    // Only refresh session-related cookies, keep stable ones
    this.cookies.set('nstore_session', this.generateNstoreSession());
    this.cookies.set('nstore_pagesession', generatePageSession());
    this.cookies.set('SRT30', generateTimestamp());
    this.cookies.set('SRT5', generateTimestamp());
    this.cookies.set('BUC', generateBUC());
    
    // Occasionally refresh the tracking token
    if (Math.random() < 0.3) { // 30% chance
      this.cookies.set('X-Wtm-Cpt-Tk', generateXWtmCptTk());
    }
  }
  
  /**
   * Use the exact working cookies from cURL (for testing)
   */
  useWorkingCookies(): void {
    this.cookies.clear();
    
    // Exact cookies from your working cURL request
    this.cookies.set('NAC', 'l2n3BcQFQesiA');
    this.cookies.set('nstore_session', 'EIqwRigKNRfjo29nXqi40vZy');
    this.cookies.set('NNB', 'IHI3QG5SW2VGQ');
    this.cookies.set('X-Wtm-Cpt-Tk', 'JxHg_qadz2bwsU8UkDGNfLhihkcWvEXZjdss11JiLNKD5kofqouu4uPGaFfuHL4mLH8QsyzIf_-YLQqra97Ikac91M_7cN8I4wIuHxP0fjV7XZYRC6zmkOD5OJh_slDfPjeCiN4y8zbHhyDq1TDq3QM_7SZOfCdzD3DUM_rM-Of2HCsGDUk_k-KL0arQkHsNrYquwwLFTrvzGig45QgUplJ0Mr21z2CUizs5nvbMLP854W0EUtLfxC-UChURJsgmnmtml0jQbmMUZB0FELwdflSERop2Lip8LL1lWIqB3-bb5nouOTa7c9drpQ_7PH5eCCC5JhkyFT8vU9KWXD-hJqyuxbYb-dRnbUejPF5vqe0mNi4jzzQSEH0=');
    this.cookies.set('nstore_pagesession', 'j6Jr2sqrfGBbnwsMVN8-465106');
    this.cookies.set('RELATED_PRODUCT', 'ON');
    this.cookies.set('SRT30', '1756294108');
    this.cookies.set('SRT5', '1756294108');
    this.cookies.set('BUC', 'q-mukZ1ynxsXGUROINROhmlNAfPUEtcCCLW-3hBaL34');
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
  
  /**
   * Reset to working cookies if current ones fail
   */
  resetToWorking(): void {
    logger.info('Resetting to working cookies from cURL');
    this.useWorkingCookies();
  }
}

// Global cookie manager instance
export const cookieManager = new CookieManager();

// Use working cookies initially for better success rate
cookieManager.useWorkingCookies();

/**
 * Periodically refresh session cookies (every 15 minutes)
 * Less frequent to avoid disrupting working sessions
 */
setInterval(() => {
  cookieManager.refreshSession();
}, 15 * 60 * 1000);

// Import logger if available
let logger: any;
try {
  const loggerModule = await import('../utils/logger.js');
  logger = loggerModule.logger;
} catch {
  // Fallback logger
  logger = {
    info: console.log,
    warn: console.warn,
    error: console.error,
    debug: console.log
  };
}