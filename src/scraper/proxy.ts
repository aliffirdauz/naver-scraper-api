import { ProxyConfig } from "./types.js";
import { config } from "../config.js";

/**
 * Simple proxy pool manager
 * For production, you'd want multiple proxies and health checking
 */
export class ProxyPool {
  private proxies: ProxyConfig[] = [];
  private currentIndex = 0;

  constructor() {
    if (config.proxy.enabled && config.proxy.host && config.proxy.port) {
      this.proxies.push({
        host: config.proxy.host,
        port: Number(config.proxy.port),
        username: config.proxy.username ?? "", // <-- pastikan string
        password: config.proxy.password ?? "", // <-- pastikan string
      });
    }
  }

  /**
   * Get next proxy in rotation
   */
  getProxy(): ProxyConfig | null {
    if (this.proxies.length === 0) return null;

    const proxy = this.proxies[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.proxies.length;

    return proxy;
  }

  /**
   * Add a proxy to the pool
   */
  addProxy(proxy: ProxyConfig): void {
    this.proxies.push(proxy);
  }

  /**
   * Get proxy count
   */
  getProxyCount(): number {
    return this.proxies.length;
  }

  /**
   * Convert proxy config to undici dispatcher options
   */
  static toUndiciOptions(proxy: ProxyConfig) {
    const auth =
      proxy.username && proxy.password
        ? `${proxy.username}:${proxy.password}`
        : undefined;

    return {
      uri: `http://${proxy.host}:${proxy.port}`,
      auth,
    };
  }

  /**
   * Convert proxy config to HTTP proxy URL
   */
  static toProxyUrl(proxy: ProxyConfig): string {
    const auth =
      proxy.username && proxy.password
        ? `${proxy.username}:${proxy.password}@`
        : "";

    return `http://${auth}${proxy.host}:${proxy.port}`;
  }
}

// Global proxy pool instance
export const proxyPool = new ProxyPool();
