# Naver Shopping Scraper API

A production-ready, scalable API that scrapes Naver Shopping's `paged-composite-cards` JSON endpoint with advanced anti-detection features.

## 🎯 Features

- **High Performance**: Handles 1000+ requests with ≤6s average latency
- **Anti-Detection**: Rotating user agents, fingerprints, proxy support, jittered delays
- **Resilient**: Exponential backoff, circuit breaker, retry logic
- **Observable**: Real-time metrics, health checks, SLA monitoring
- **Production Ready**: TypeScript, proper error handling, graceful shutdown

## 🏗️ Architecture

```
REST API → Rate Limiter → Circuit Breaker → Core Scraper → Naver API
    ↓           ↓              ↓               ↓
 Fastify    p-limit     Auto-recovery    UA Rotation
                                         Proxy Pool
                                         Retry Logic
```

## 🚀 Quick Start

### 1. Setup Project

```bash
# Clone and install
git clone <your-repo>
cd naver-scraper-api
npm install

# Copy environment template
cp .env.example .env
```

### 2. Configure Environment

Edit `.env` with your settings:

```bash
# Server
PORT=3000
NODE_ENV=development

# Proxy (optional but recommended)
PROXY_ROTATION=on
PROXY_HOST=your-proxy-host.com
PROXY_PORT=8080
PROXY_USERNAME=your-username
PROXY_PASSWORD=your-password

# Performance tuning
MAX_CONCURRENT_REQUESTS=10
REQUESTS_PER_HOUR=200
DEFAULT_TIMEOUT_MS=8000
```

### 3. Start Server

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

Server runs on `http://localhost:3000`

### 4. Test API

```bash
# Basic test
curl "http://localhost:3000/naver?url=https://search.shopping.naver.com/ns/search?query=iphone"

# Health check
curl http://localhost:3000/health

# Metrics
curl http://localhost:3000/metrics
```

## 🔍 Finding the paged-composite-cards API

**Step-by-step guide to capture the API endpoint:**

1. **Open Naver Shopping**:
   ```
   https://search.shopping.naver.com/ns/search?query=iphone
   ```

2. **Open DevTools**:
   - Press `F12` or right-click → Inspect
   - Go to **Network** tab
   - Click **Clear** (🗑️) to clean requests

3. **Trigger API Call**:
   - Apply any filter (price range, brand, etc.)
   - OR scroll down to trigger pagination
   - OR change sort order

4. **Find the Request**:
   - Look for `paged-composite-cards` in the request list
   - It should be an XHR/Fetch request to:
   ```
   /ns/v1/search/paged-composite-cards?query=iphone&...
   ```

5. **Copy Request Details**:
   - Right-click the request → Copy → Copy as cURL
   - Note the headers, especially:
     - `User-Agent`
     - `Referer`
     - `X-Requested-With`
     - Any cookies

6. **Test with Our API**:
   ```bash
   curl "http://localhost:3000/naver?url=https://search.shopping.naver.com/ns/v1/search/paged-composite-cards?query=iphone"
   ```

## 📡 API Reference

### GET /naver

Scrape Naver Shopping data from paged-composite-cards endpoint.

**Parameters:**
- `url` (required): Full Naver shopping URL or paged-composite-cards API URL

**Example Request:**
```bash
curl "http://localhost:3000/naver?url=https://search.shopping.naver.com/ns/search?query=iphone"
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "products": [...],
    "totalCount": 1234,
    "cursor": "...",
    "hasNext": true
  },
  "metadata": {
    "fetchedAt": "2023-12-07T10:30:00.000Z",
    "sourceUrl": "https://search.shopping.naver.com/ns/v1/search/paged-composite-cards?query=iphone",
    "latencyMs": 1245,
    "attempts": 1
  }
}
```

### POST /naver/batch

Scrape multiple URLs in parallel (max 100 URLs).

**Request Body:**
```json
{
  "urls": [
    "https://search.shopping.naver.com/ns/search?query=iphone",
    "https://search.shopping.naver.com/ns/search?query=galaxy"
  ],
  "concurrency": 5
}
```

### GET /health

Health check endpoint with SLA compliance status.

**Response:**
```json
{
  "status": "healthy",
  "sla": {
    "avgLatencyOk": true,
    "errorRateOk": true,
    "summary": "Latency: 1234ms (OK), Success Rate: 98.5% (OK)"
  },
  "circuitBreaker": {
    "state": "CLOSED",
    "errorRate": 2.1
  }
}
```

### GET /metrics

Detailed performance metrics.

**Response:**
```json
{
  "totalRequests": 1500,
  "successfulRequests": 1485,
  "successRate": 99.0,
  "averageLatencyMs": 1234,
  "p95LatencyMs": 2100,
  "errorsByStatus": {
    "429": 10,
    "503": 5
  }
}
```

## 🔧 Configuration Options

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Server port |
| `MAX_CONCURRENT_REQUESTS` | 10 | Max parallel requests |
| `DEFAULT_TIMEOUT_MS` | 8000 | Request timeout |
| `MAX_RETRIES` | 3 | Retry attempts |
| `MIN_DELAY_MS` | 500 | Min delay between requests |
| `MAX_DELAY_MS` | 2000 | Max delay between requests |
| `CIRCUIT_BREAKER_THRESHOLD` | 50 | Error rate % to trip breaker |
| `PROXY_ROTATION` | off | Enable proxy rotation |

### Performance Tuning

**For High Throughput** (>300 req/h):
```bash
MAX_CONCURRENT_REQUESTS=15
MIN_DELAY_MS=200
MAX_DELAY_MS=800
```

**For Stealth** (anti-detection focus):
```bash
MAX_CONCURRENT_REQUESTS=5
MIN_DELAY_MS=1000
MAX_DELAY_MS=3000
PROXY_ROTATION=on
```

## 🛡️ Anti-Detection Features

### User Agent Rotation
- Pool of 7+ realistic desktop browser UAs
- Automatic Chrome version matching
- Mobile/desktop mix

### Header Fingerprinting
- Rotating `Accept-Language` (Korean + English)
- Proper `Sec-Ch-Ua` headers
- Randomized header ordering
- Essential Naver-specific headers

### Request Patterns
- Jittered delays (random ±20%)
- Exponential backoff on errors
- Request randomization
- Natural timing patterns

### Proxy Support
- HTTP proxy rotation
- Authenticated proxy support
- Automatic failover
- Session stickiness options

## 🧪 Load Testing

Run the built-in load tester to verify SLA compliance:

```bash
# Test against local server
npm run test:load

# Test against ngrok URL
npx tsx src/load-test.ts https://your-id.ngrok.io
```

**Test Configuration:**
- 1200+ requests over 60 minutes
- 15 concurrent requests max
- Validates ≤6s avg latency, ≥95% success rate

**Example Output:**
```
📊 LOAD TEST RESULTS
==================================================
Total Requests: 1200
Successful: 1176 (98.0%)
Failed: 24
Average Latency: 1,234ms
P95 Latency: 2,100ms

🎯 SLA COMPLIANCE CHECK
Requests: ✅ (1200/1000)
Avg Latency: ✅ (1234ms/6000ms)
Success Rate: ✅ (98.0%/95%)
Overall SLA: ✅ PASS

🎉 Test PASSED!
```

## 🌐 Exposing via ngrok

### Install ngrok
```bash
# Install ngrok
npm install -g ngrok

# Sign up at ngrok.com and get auth token
ngrok authtoken YOUR_TOKEN
```

### Expose Server
```bash
# Start your API server
npm run dev

# In another terminal, expose it
ngrok http 3000
```

You'll get a public URL like: `https://abc123.ngrok.io`

### Test Public Endpoint
```bash
curl "https://abc123.ngrok.io/naver?url=https://search.shopping.naver.com/ns/search?query=iphone"
```

## 🐛 Debugging & Troubleshooting

### Common Issues

**1. 403 Forbidden Errors**
```bash
# Check if headers are properly set
curl -H "User-Agent: Mozilla/5.0..." -H "Referer: https://search.shopping.naver.com/" ...

# Enable proxy if needed
PROXY_ROTATION=on
```

**2. High Latency (>6s)**
```bash
# Reduce concurrency
MAX_CONCURRENT_REQUESTS=5

# Increase delays
MIN_DELAY_MS=1000
MAX_DELAY_MS=2000
```

**3. High Error Rate (>5%)**
```bash
# Check circuit breaker status
curl http://localhost:3000/health

# Reset if needed
curl -X POST http://localhost:3000/metrics/reset
```

**4. Timeout Issues**
```bash
# Increase timeout
DEFAULT_TIMEOUT_MS=12000

# Check proxy connectivity
curl --proxy http://proxy:port https://httpbin.org/ip
```

### Debug Mode

Enable verbose logging:
```bash
LOG_LEVEL=debug npm run dev
```

### Monitoring

Watch metrics in real-time:
```bash
# Every 10 seconds
watch -n 10 curl -s http://localhost:3000/metrics
```

## 📊 Meeting SLA Requirements

The scraper is designed to meet these specific requirements:

✅ **1000+ API calls**: Load tester validates with 1200 requests  
✅ **≤6s average latency**: Tuned concurrency and delays  
✅ **≤5% error rate**: Circuit breaker and retry logic  
✅ **1 hour stability**: Continuous operation without degradation  

**Key Design Decisions:**
- **Concurrency**: Limited to 10-15 to prevent overloading
- **Delays**: 500-2000ms jittered delays for natural patterns
- **Retries**: 3 attempts with exponential backoff
- **Circuit Breaker**: Fails fast when error rate >50%
- **Metrics**: Real-time SLA monitoring

## 🔒 Security & Legal

- **Rate Limiting**: Built-in to respect server resources
- **Proxy Support**: Hide origin IP for privacy
- **No Data Storage**: Stateless, no persistent data storage
- **Respectful Scraping**: Follows robots.txt principles
- **Educational Purpose**: For learning web scraping techniques

## 📝 Development

### Project Structure
```
src/
├── server.ts              # Fastify API server
├── scraper/
│   ├── index.ts           # Main scraper logic
│   ├── types.ts           # Zod schemas & types
│   ├── headers.ts         # UA rotation & fingerprinting
│   ├── proxy.ts           # Proxy pool management
│   └── retry.ts           # Backoff & circuit breaker
├── utils/
│   ├── logger.ts          # Structured logging
│   ├── metrics.ts         # Performance tracking
│   └── url-parser.ts      # URL validation & parsing
├── load-test.ts           # Load testing script
└── config.ts              # Environment configuration
```

### Scripts
```bash
npm run build      # Compile TypeScript
npm run dev        # Development with hot reload
npm run start      # Production server
npm run test:load  # Run load tests
npm run lint       # ESLint check
```

### Dependencies
- **undici**: Fast HTTP client with proxy support
- **fastify**: High-performance web framework
- **p-limit**: Concurrency control
- **zod**: Schema validation
- **bottleneck**: Rate limiting (future use)

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

## 📄 License

This project is for educational purposes. Please respect Naver's terms of service and rate limits.

---

**Need Help?** Check the [Troubleshooting](#-debugging--troubleshooting) section or open an issue!