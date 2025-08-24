import { ParsedNaverUrl } from '../scraper/types.js';
  
/**
 * Parse Naver Shopping URL and extract API parameters
 * Based on your captured request parameters
 */
export function parseNaverUrl(url: string): ParsedNaverUrl {
  try {
    const urlObj = new URL(url);
    
    // Validate that it's a Naver shopping URL
    if (!urlObj.hostname.includes('naver.com')) {
      throw new Error('Invalid URL: must be a Naver shopping URL');
    }
    
    const params = urlObj.searchParams;
    const query = params.get('query') || '';
    const cursor = params.get('cursor') || '1'; // Default to page 1
    const pageSize = params.get('pageSize') ? parseInt(params.get('pageSize')!, 10) : 50; // Default 50 like captured
    
    // Collect all other parameters (Naver has many specific ones)
    const additionalParams: Record<string, string> = {};
    
    // Essential Naver parameters from your capture
    const naverParams = [
      'searchMethod', 'isFreshCategory', 'isOriginalQuerySearch', 
      'isCatalogDiversifyOff', 'listPage', 'categoryIdsForPromotions',
      'hiddenNonProductCard', 'hasMoreAd', 'score'
    ];
    
    for (const [key, value] of params.entries()) {
      if (!['query', 'cursor', 'pageSize'].includes(key)) {
        additionalParams[key] = value;
      }
    }
    
    // Add default Naver parameters if missing
    if (!additionalParams.searchMethod) additionalParams.searchMethod = 'all.basic';
    if (!additionalParams.isFreshCategory) additionalParams.isFreshCategory = 'false';
    if (!additionalParams.isOriginalQuerySearch) additionalParams.isOriginalQuerySearch = 'false';
    if (!additionalParams.isCatalogDiversifyOff) additionalParams.isCatalogDiversifyOff = 'false';
    if (!additionalParams.listPage) additionalParams.listPage = '1';
    if (!additionalParams.hiddenNonProductCard) additionalParams.hiddenNonProductCard = 'true';
    if (!additionalParams.hasMoreAd) additionalParams.hasMoreAd = 'true';
    
    return {
      baseUrl: `${urlObj.protocol}//${urlObj.hostname}`,
      query,
      cursor,
      pageSize,
      additionalParams
    };
  } catch (error) {
    throw new Error(`Failed to parse Naver URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Build the paged-composite-cards API URL from parsed components
 * Creates the exact URL structure that Naver expects
 */
export function buildApiUrl(parsed: ParsedNaverUrl): string {
  const apiUrl = new URL('/ns/v1/search/paged-composite-cards', parsed.baseUrl);
  
  // Add parameters in the same order as captured request
  if (parsed.cursor) {
    apiUrl.searchParams.set('cursor', parsed.cursor);
  }
  
  if (parsed.pageSize) {
    apiUrl.searchParams.set('pageSize', parsed.pageSize.toString());
  }
  
  if (parsed.query) {
    apiUrl.searchParams.set('query', parsed.query);
  }
  
  // Add additional parameters in alphabetical order (like browser does)
  const sortedParams = Object.entries(parsed.additionalParams).sort();
  for (const [key, value] of sortedParams) {
    // Handle multiple values for same key (like categoryIdsForPromotions)
    if (key === 'categoryIdsForPromotions') {
      // Split multiple values if they exist
      const values = value.split(',');
      values.forEach(val => {
        if (val.trim()) {
          apiUrl.searchParams.append(key, val.trim());
        }
      });
    } else {
      apiUrl.searchParams.set(key, value);
    }
  }
  
  return apiUrl.toString();
}

/**
 * Build referer URL for the request (important for Naver)
 */
export function buildRefererUrl(parsed: ParsedNaverUrl): string {
  const refererUrl = new URL('/ns/search', parsed.baseUrl);
  
  if (parsed.query) {
    refererUrl.searchParams.set('query', parsed.query);
  }
  
  // Add score filter if present (like in your capture)
  if (parsed.additionalParams.score) {
    refererUrl.searchParams.set('score', parsed.additionalParams.score);
  }
  
  return refererUrl.toString();
}

/**
 * Check if URL is already a paged-composite-cards API URL
 */
export function isApiUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return urlObj.pathname.includes('paged-composite-cards');
  } catch {
    return false;
  }
}

/**
 * Validate and normalize any Naver shopping URL to API format
 */
export function normalizeToApiUrl(url: string): string {
  if (isApiUrl(url)) {
    return url; // Already an API URL
  }
  
  const parsed = parseNaverUrl(url);
  return buildApiUrl(parsed);
}

/**
 * Extract search parameters from URL for analytics
 */
export function extractSearchInfo(url: string): {
  query: string;
  cursor: string;
  pageSize: number;
  hasFilters: boolean;
  filterCount: number;
} {
  const parsed = parseNaverUrl(url);
  const filterKeys = ['score', 'categoryIdsForPromotions', 'brand', 'price'];
  const activeFilters = filterKeys.filter(key => parsed.additionalParams[key]);
  
  return {
    query: parsed.query,
    cursor: parsed.cursor || '1',
    pageSize: parsed.pageSize || 50,
    hasFilters: activeFilters.length > 0,
    filterCount: activeFilters.length
  };
}