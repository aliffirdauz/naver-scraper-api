import 'dotenv/config';
import Fastify from 'fastify';
import { fetchPagedCompositeCards, toPagedCompositeUrl } from './scraper/index.js';
import { getCircuitBreakerStatus, resetCircuitBreaker } from './utils/circuitBreaker.js';
import { recordSample, metricsSummary } from './utils/metrics.js';

function hasModule(name: string) {
  try { return !!require.resolve(name); } catch { return false; }
}

const enablePretty = process.env.LOG_PRETTY === '1' && hasModule('pino-pretty');
const logger: any = enablePretty
  ? {
      transport: { target: 'pino-pretty', options: { singleLine: true, colorize: true, translateTime: 'SYS:standard' } },
      level: process.env.LOG_LEVEL || 'info'
    }
  : { level: process.env.LOG_LEVEL || 'info' };

const app = Fastify({ logger });

const PORT = Number(process.env.PORT ?? 3000);

app.get('/health', async () => {
  return {
    ok: true,
    time: new Date().toISOString(),
    proxyEnabled: process.env.PROXY_ROTATION === 'on' && process.env.FORCE_DIRECT !== '1',
    circuitBreaker: getCircuitBreakerStatus()
  };
});

app.get('/metrics', async () => metricsSummary());

app.post('/reset', async () => {
  resetCircuitBreaker();
  return { ok: true };
});

app.get('/naver', async (req, reply) => {
  const urlParam = (req.query as any)?.url;
  if (!urlParam || typeof urlParam !== 'string') {
    reply.code(400);
    return { success: false, error: 'Missing ?url=' };
  }

  const sourceUrl = urlParam;
  const start = Date.now();

  try {
    const data = await fetchPagedCompositeCards(sourceUrl);
    const latency = Date.now() - start;
    recordSample(true, latency);

    return {
      success: true,
      fetchedAt: new Date().toISOString(),
      sourceUrl,
      normalizedUrl: toPagedCompositeUrl(sourceUrl),
      data
    };
  } catch (err: any) {
    const latency = Date.now() - start;
    recordSample(false, latency);

    req.log.error({ err, sourceUrl }, 'Scraping failed');
    reply.code(500);
    return {
      success: false,
      error: String(err?.message ?? err),
      timestamp: new Date().toISOString(),
      url: sourceUrl
    };
  }
});

app.listen({ port: PORT, host: '0.0.0.0' })
  .then(() => {
    app.log.info(`🚀 Server running on http://localhost:${PORT}`);
    app.log.info(`📊 Health:  http://localhost:${PORT}/health`);
    app.log.info(`📈 Metrics: http://localhost:${PORT}/metrics`);
    app.log.info(`🌐 Proxy enabled: ${process.env.PROXY_ROTATION === 'on' && process.env.FORCE_DIRECT !== '1' ? 'Yes' : 'No'}`);
  })
  .catch(err => {
    app.log.error(err);
    process.exit(1);
  });
