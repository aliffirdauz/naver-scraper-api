#!/usr/bin/env tsx

import { performance } from "perf_hooks";
import { start } from "repl";

/**
 * Load testing script for Naver scraper API
 * Tests the 1000+ requests, ≤6s latency, ≤5% error requirements
 */

interface TestResult {
  url: string;
  success: boolean;
  latencyMs: number;
  statusCode: number;
  error: string;
  timestamp: number;
}

interface TestSummary {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  successRate: number;
  averageLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  requestsPerSecond: number;
  testDurationSeconds: number;
  slaCompliant: boolean;
}

class LoadTester {
  private apiBaseUrl: string;
  private testUrls: string[];
  private results: TestResult[] = [];

  constructor(apiBaseUrl: string = "http://localhost:3000") {
    this.apiBaseUrl = apiBaseUrl;

    // Sample Naver shopping URLs for testing (based on real patterns)
    this.testUrls = [
      // Basic searches
      "https://search.shopping.naver.com/ns/search?query=iphone",
      "https://search.shopping.naver.com/ns/search?query=samsung+galaxy",
      "https://search.shopping.naver.com/ns/search?query=macbook",
      "https://search.shopping.naver.com/ns/search?query=nike",

      // With filters (like your captured request)
      "https://search.shopping.naver.com/ns/search?query=iphone&score=4.8%7C5",
      "https://search.shopping.naver.com/ns/search?query=laptop&score=4.0%7C5",

      // With pagination
      "https://search.shopping.naver.com/ns/v1/search/paged-composite-cards?cursor=2&pageSize=50&query=headphones&searchMethod=all.basic",
      "https://search.shopping.naver.com/ns/v1/search/paged-composite-cards?cursor=3&pageSize=50&query=camera&searchMethod=all.basic",

      // Different page sizes
      "https://search.shopping.naver.com/ns/search?query=watch&pageSize=20",
      "https://search.shopping.naver.com/ns/search?query=tablet&pageSize=100",
    ];
  }

  /**
   * Make a single request to the API
   */
  private async makeRequest(url: string): Promise<TestResult> {
    const startTime = performance.now();
    const timestamp = Date.now();

    try {
      const apiUrl = `${this.apiBaseUrl}/naver?url=${encodeURIComponent(url)}`;

      const response = await fetch(apiUrl, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": "LoadTester/1.0",
        },
        // 10 second timeout
        signal: AbortSignal.timeout(10000),
      });

      const latencyMs = performance.now() - startTime;

      return {
        url,
        success: true,
        latencyMs,
        statusCode: response.status,
        timestamp: Date.now(),
        error: "", // <-- kosong pada sukses
      };
    } catch (error: any) {
      const latencyMs = performance.now() - startTime;

      return {
        url,
        success: false,
        latencyMs: Math.round(latencyMs),
        statusCode: 0,
        timestamp: Date.now(),
        error: (error as Error)?.message ?? "unknown error", // <-- selalu string
      };
    }
  }

  /**
   * Run load test with specified parameters
   */
  async runTest(options: {
    totalRequests: number;
    concurrency: number;
    durationMinutes?: number;
    rampUpSeconds?: number;
  }): Promise<TestSummary> {
    const {
      totalRequests,
      concurrency,
      durationMinutes = 60,
      rampUpSeconds = 30,
    } = options;

    console.log(`🚀 Starting load test:`);
    console.log(`   Target: ${this.apiBaseUrl}`);
    console.log(`   Total requests: ${totalRequests}`);
    console.log(`   Concurrency: ${concurrency}`);
    console.log(`   Duration: ${durationMinutes} minutes`);
    console.log(`   Ramp up: ${rampUpSeconds} seconds`);
    console.log(`   Test URLs: ${this.testUrls.length} variations\n`);

    const testStartTime = performance.now();
    let requestCount = 0;
    let activeRequests = 0;

    // Calculate request rate
    const targetRPS = totalRequests / (durationMinutes * 60);
    const requestInterval = 1000 / targetRPS; // ms between requests

    console.log(`📊 Target rate: ${targetRPS.toFixed(2)} requests/second`);
    console.log(`   Request interval: ${requestInterval.toFixed(0)}ms\n`);

    const sendRequest = async () => {
      if (requestCount >= totalRequests) return;

      activeRequests++;
      requestCount++;

      // Pick random URL from pool
      const url =
        this.testUrls[Math.floor(Math.random() * this.testUrls.length)];

      try {
        const result = await this.makeRequest(url);
        this.results.push(result);

        // Progress indicator
        if (requestCount % 50 === 0) {
          const elapsed = (performance.now() - testStartTime) / 1000;
          const rate = requestCount / elapsed;
          console.log(
            `📈 Progress: ${requestCount}/${totalRequests} requests (${rate.toFixed(
              1
            )} req/s)`
          );
        }
      } catch (error) {
        console.error(`❌ Request failed:`, error);
      } finally {
        activeRequests--;
      }
    };

    // Start sending requests at target rate
    const requestTimer = setInterval(async () => {
      // Respect concurrency limit
      if (activeRequests < concurrency && requestCount < totalRequests) {
        sendRequest();
      }

      // Stop when target reached
      if (requestCount >= totalRequests) {
        clearInterval(requestTimer);
      }
    }, requestInterval);

    // Wait for all requests to complete
    while (activeRequests > 0 || requestCount < totalRequests) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    const testEndTime = performance.now();
    const testDurationSeconds = (testEndTime - testStartTime) / 1000;

    console.log(
      `\n✅ Load test completed in ${testDurationSeconds.toFixed(1)} seconds`
    );

    return this.generateSummary(testDurationSeconds);
  }

  /**
   * Generate test summary and check SLA compliance
   */
  private generateSummary(testDurationSeconds: number): TestSummary {
    const successfulRequests = this.results.filter((r) => r.success).length;
    const failedRequests = this.results.length - successfulRequests;
    const successRate = (successfulRequests / this.results.length) * 100;

    // Calculate latency percentiles
    const latencies = this.results
      .map((r) => r.latencyMs)
      .sort((a, b) => a - b);
    const averageLatencyMs =
      latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;

    const p50Index = Math.floor(latencies.length * 0.5);
    const p95Index = Math.floor(latencies.length * 0.95);
    const p99Index = Math.floor(latencies.length * 0.99);

    const summary: TestSummary = {
      totalRequests: this.results.length,
      successfulRequests,
      failedRequests,
      successRate: Number(successRate.toFixed(2)),
      averageLatencyMs: Number(averageLatencyMs.toFixed(2)),
      p50LatencyMs: latencies[p50Index] || 0,
      p95LatencyMs: latencies[p95Index] || 0,
      p99LatencyMs: latencies[p99Index] || 0,
      minLatencyMs: latencies[0] || 0,
      maxLatencyMs: latencies[latencies.length - 1] || 0,
      requestsPerSecond: Number(
        (this.results.length / testDurationSeconds).toFixed(2)
      ),
      testDurationSeconds: Number(testDurationSeconds.toFixed(1)),
      slaCompliant: averageLatencyMs <= 6000 && successRate >= 95,
    };

    return summary;
  }

  /**
   * Print detailed test results
   */
  printResults(summary: TestSummary): void {
    console.log(`\n📊 LOAD TEST RESULTS`);
    console.log(`=${"=".repeat(50)}`);
    console.log(`Total Requests: ${summary.totalRequests}`);
    console.log(
      `Successful: ${summary.successfulRequests} (${summary.successRate}%)`
    );
    console.log(`Failed: ${summary.failedRequests}`);
    console.log(`Test Duration: ${summary.testDurationSeconds}s`);
    console.log(`Request Rate: ${summary.requestsPerSecond} req/s`);
    console.log(``);
    console.log(`📈 LATENCY METRICS`);
    console.log(`Average: ${summary.averageLatencyMs}ms`);
    console.log(`P50: ${summary.p50LatencyMs}ms`);
    console.log(`P95: ${summary.p95LatencyMs}ms`);
    console.log(`P99: ${summary.p99LatencyMs}ms`);
    console.log(`Min: ${summary.minLatencyMs}ms`);
    console.log(`Max: ${summary.maxLatencyMs}ms`);
    console.log(``);
    console.log(`🎯 SLA COMPLIANCE CHECK`);
    console.log(
      `Required: ≥1000 requests, ≤6000ms avg latency, ≥95% success rate`
    );
    console.log(
      `Requests: ${summary.totalRequests >= 1000 ? "✅" : "❌"} (${
        summary.totalRequests
      }/1000)`
    );
    console.log(
      `Avg Latency: ${summary.averageLatencyMs <= 6000 ? "✅" : "❌"} (${
        summary.averageLatencyMs
      }ms/6000ms)`
    );
    console.log(
      `Success Rate: ${summary.successRate >= 95 ? "✅" : "❌"} (${
        summary.successRate
      }%/95%)`
    );
    console.log(`Overall SLA: ${summary.slaCompliant ? "✅ PASS" : "❌ FAIL"}`);

    // Error breakdown
    if (summary.failedRequests > 0) {
      console.log(`\n❌ ERROR BREAKDOWN`);
      const errorCounts: Record<string, number> = {};
      this.results
        .filter((r) => !r.success)
        .forEach((r) => {
          const errorKey = r.error || "Unknown";
          errorCounts[errorKey] = (errorCounts[errorKey] || 0) + 1;
        });

      Object.entries(errorCounts)
        .sort(([, a], [, b]) => b - a)
        .forEach(([error, count]) => {
          console.log(`   ${error}: ${count} times`);
        });
    }

    console.log(
      `\n${summary.slaCompliant ? "🎉" : "💥"} Test ${
        summary.slaCompliant ? "PASSED" : "FAILED"
      }!`
    );
  }

  /**
   * Run a quick smoke test
   */
  async smokeTest(): Promise<boolean> {
    console.log(`🔥 Running smoke test...`);

    try {
      const result = await this.makeRequest(this.testUrls[0]);

      if (result.success) {
        console.log(`✅ Smoke test passed (${result.latencyMs}ms)`);
        return true;
      } else {
        console.log(`❌ Smoke test failed: ${result.error}`);
        return false;
      }
    } catch (error) {
      console.log(`❌ Smoke test failed: ${error}`);
      return false;
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const apiUrl = args[0] || "http://localhost:3000";

  const tester = new LoadTester(apiUrl);

  // Check if server is running
  console.log(`🔍 Testing connection to ${apiUrl}...`);
  const smokeTestPassed = await tester.smokeTest();

  if (!smokeTestPassed) {
    console.log(
      `\n❌ Server not responding. Please ensure the API is running on ${apiUrl}`
    );
    console.log(`   Start the server with: npm run dev`);
    process.exit(1);
  }

  console.log(`\n🏁 Starting main load test...`);

  // Main test configuration to meet requirements
  const testConfig = {
    totalRequests: 1200, // Exceed 1000 requirement
    concurrency: 15, // Control rate to stay under 6s avg latency
    durationMinutes: 60, // 1 hour stability test
    rampUpSeconds: 30,
  };

  try {
    const summary = await tester.runTest(testConfig);
    tester.printResults(summary);

    // Exit code based on SLA compliance
    process.exit(summary.slaCompliant ? 0 : 1);
  } catch (error) {
    console.error(`💥 Load test failed:`, error);
    process.exit(1);
  }
}

// Run if this file is executed directly
// Kompatibel dengan CommonJS tanpa ubah tsconfig
// @ts-ignore - require bisa undefined di ESM, tapi di CJS ini aman
if (typeof require !== 'undefined' && require.main === module) {
  main();
}


export { LoadTester };
