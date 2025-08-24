import { MetricsData } from '../scraper/types.js';

/**
 * Simple in-memory metrics collector
 * Tracks KPIs: latency, success rate, error distribution
 */
export class MetricsCollector {
  private metrics: MetricsData = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageLatencyMs: 0,
    p95LatencyMs: 0,
    errorsByStatus: {},
    circuitBreakerTrips: 0,
    lastResetAt: new Date().toISOString()
  };
  
  private latencies: number[] = [];
  private readonly MAX_LATENCY_SAMPLES = 1000; // Keep last 1000 samples for percentiles
  
  /**
   * Record a successful request
   */
  recordSuccess(latencyMs: number): void {
    this.metrics.totalRequests++;
    this.metrics.successfulRequests++;
    this.recordLatency(latencyMs);
  }
  
  /**
   * Record a failed request
   */
  recordFailure(latencyMs: number, statusCode?: number): void {
    this.metrics.totalRequests++;
    this.metrics.failedRequests++;
    this.recordLatency(latencyMs);
    
    if (statusCode) {
      const statusKey = statusCode.toString();
      this.metrics.errorsByStatus[statusKey] = (this.metrics.errorsByStatus[statusKey] || 0) + 1;
    }
  }
  
  /**
   * Record circuit breaker trip
   */
  recordCircuitBreakerTrip(): void {
    this.metrics.circuitBreakerTrips++;
  }
  
  /**
   * Record latency and update percentiles
   */
  private recordLatency(latencyMs: number): void {
    this.latencies.push(latencyMs);
    
    // Keep only recent samples for memory efficiency
    if (this.latencies.length > this.MAX_LATENCY_SAMPLES) {
      this.latencies.shift();
    }
    
    this.updateLatencyMetrics();
  }
  
  /**
   * Update calculated latency metrics
   */
  private updateLatencyMetrics(): void {
    if (this.latencies.length === 0) return;
    
    const sorted = [...this.latencies].sort((a, b) => a - b);
    
    // Average latency
    this.metrics.averageLatencyMs = Number(
      (this.latencies.reduce((sum, lat) => sum + lat, 0) / this.latencies.length).toFixed(2)
    );
    
    // P95 latency
    const p95Index = Math.floor(sorted.length * 0.95);
    this.metrics.p95LatencyMs = sorted[p95Index] || 0;
  }
  
  /**
   * Get current metrics snapshot
   */
  getMetrics(): MetricsData {
    return { ...this.metrics };
  }
  
  /**
   * Get success rate percentage
   */
  getSuccessRate(): number {
    if (this.metrics.totalRequests === 0) return 100;
    return Number(((this.metrics.successfulRequests / this.metrics.totalRequests) * 100).toFixed(2));
  }
  
  /**
   * Check if we're meeting SLA requirements
   */
  checkSLA(): {
    avgLatencyOk: boolean;
    errorRateOk: boolean;
    summary: string;
  } {
    const successRate = this.getSuccessRate();
    const avgLatencyOk = this.metrics.averageLatencyMs <= 6000; // ≤6s requirement
    const errorRateOk = successRate >= 95; // ≤5% error rate requirement
    
    return {
      avgLatencyOk,
      errorRateOk,
      summary: `Latency: ${this.metrics.averageLatencyMs}ms (${avgLatencyOk ? 'OK' : 'FAIL'}), Success Rate: ${successRate}% (${errorRateOk ? 'OK' : 'FAIL'})`
    };
  }
  
  /**
   * Reset all metrics
   */
  reset(): void {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageLatencyMs: 0,
      p95LatencyMs: 0,
      errorsByStatus: {},
      circuitBreakerTrips: 0,
      lastResetAt: new Date().toISOString()
    };
    this.latencies = [];
  }
  
  /**
   * Get human-readable metrics summary
   */
  getSummary(): string {
    const sla = this.checkSLA();
    return [
      `📊 Metrics Summary`,
      `Total Requests: ${this.metrics.totalRequests}`,
      `Success Rate: ${this.getSuccessRate()}% (${this.metrics.successfulRequests}/${this.metrics.totalRequests})`,
      `Avg Latency: ${this.metrics.averageLatencyMs}ms`,
      `P95 Latency: ${this.metrics.p95LatencyMs}ms`,
      `Circuit Breaker Trips: ${this.metrics.circuitBreakerTrips}`,
      `SLA Status: ${sla.summary}`,
      `Last Reset: ${this.metrics.lastResetAt}`
    ].join('\n');
  }
}

// Global metrics instance
export const metrics = new MetricsCollector();