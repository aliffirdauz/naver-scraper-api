#!/usr/bin/env tsx

/**
 * Proxy-specific diagnostic script for Indonesia -> Korea access
 * Run with: npx tsx src/proxy-diagnose.ts
 */

import { request } from 'undici';
import { ProxyAgent } from 'undici';
import { config } from './config.js';

interface ProxyTest {
  name: string;
  success: boolean;
  latency?: number;
  error?: string;
  details?: any;
}

class ProxyDiagnostics {
  private tests: ProxyTest[] = [];

  /**
   * Test if proxy server is reachable
   */
  async testProxyBasicConnection(): Promise<ProxyTest> {
    console.log('🔍 Testing basic proxy connection...');
    const start = Date.now();

    if (!config.proxy.host || !config.proxy.port) {
      return {
        name: 'Proxy Basic Connection',
        success: false,
        error: 'No proxy configuration found in environment variables'
      };
    }

    try {
      const proxyOptions: any = {
        uri: `http://${config.proxy.host}:${config.proxy.port}`,
        requestTls: { rejectUnauthorized: false },
      };

      if (config.proxy.username && config.proxy.password) {
        proxyOptions.auth = `${config.proxy.username}:${config.proxy.password}`;
      }

      const proxyAgent = new ProxyAgent(proxyOptions);

      // Test with a simple HTTP request
      const response = await request('http://httpbin.org/ip', {
        dispatcher: proxyAgent,
        method: 'GET',
        headersTimeout: 15000,
        bodyTimeout: 15000,
        throwOnError: false,
        headers: {
          'User-Agent': 'Proxy-Test/1.0'
        }
      });

      const latency = Date.now() - start;
      const success = response.statusCode === 200;

      let responseData = null;
      if (success) {
        try {
          const body = await response.body.text();
          responseData = JSON.parse(body);
        } catch (e) {
          // Ignore parsing errors for basic connectivity test
        }
      }

      await proxyAgent.close();

      return {
        name: 'Proxy Basic Connection',
        success,
        latency,
        details: {
          proxyHost: config.proxy.host,
          proxyPort: config.proxy.port,
          hasAuth: !!(config.proxy.username && config.proxy.password),
          statusCode: response.statusCode,
          exitIP: responseData?.origin
        }
      };

    } catch (error) {
      return {
        name: 'Proxy Basic Connection',
        success: false,
        latency: Date.now() - start,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Test HTTPS through proxy (important for Naver)
   */
  async testProxyHTTPS(): Promise<ProxyTest> {
    console.log('🔍 Testing HTTPS through proxy...');
    const start = Date.now();

    try {
      const proxyOptions: any = {
        uri: `http://${config.proxy.host}:${config.proxy.port}`,
        requestTls: { rejectUnauthorized: false },
      };

      if (config.proxy.username && config.proxy.password) {
        proxyOptions.auth = `${config.proxy.username}:${config.proxy.password}`;
      }

      const proxyAgent = new ProxyAgent(proxyOptions);

      // Test HTTPS through proxy
      const response = await request('https://httpbin.org/ip', {
        dispatcher: proxyAgent,
        method: 'GET',
        headersTimeout: 15000,
        bodyTimeout: 15000,
        throwOnError: false,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const latency = Date.now() - start;
      const success = response.statusCode === 200;

      await proxyAgent.close();

      return {
        name: 'Proxy HTTPS Support',
        success,
        latency,
        details: {
          statusCode: response.statusCode,
          headers: Object.keys(response.headers)
        }
      };

    } catch (error) {
      return {
        name: 'Proxy HTTPS Support',
        success: false,
        latency: Date.now() - start,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Test access to Korean websites through proxy
   */
  async testKoreanAccess(): Promise<ProxyTest> {
    console.log('🔍 Testing access to Korean websites...');
    const start = Date.now();

    try {
      const proxyOptions: any = {
        uri: `http://${config.proxy.host}:${config.proxy.port}`,
        requestTls: { rejectUnauthorized: false },
      };

      if (config.proxy.username && config.proxy.password) {
        proxyOptions.auth = `${config.proxy.username}:${config.proxy.password}`;
      }

      const proxyAgent = new ProxyAgent(proxyOptions);

      // Test access to Naver main site
      const response = await request('https://naver.com', {
        dispatcher: proxyAgent,
        method: 'GET',
        headersTimeout: 20000,
        bodyTimeout: 20000,
        throwOnError: false,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8'
        }
      });

      const latency = Date.now() - start;
      const success = response.statusCode === 200;

      let bodyPreview = '';
      if (success) {
        try {
          const body = await response.body.text();
          bodyPreview = body.substring(0, 200);
        } catch (e) {
          bodyPreview = 'Could not read response body';
        }
      }

      await proxyAgent.close();

      return {
        name: 'Korean Website Access (Naver)',
        success,
        latency,
        details: {
          statusCode: response.statusCode,
          bodyPreview
        }
      };

    } catch (error) {
      return {
        name: 'Korean Website Access (Naver)',
        success: false,
        latency: Date.now() - start,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}