type Sample = { ok: boolean; ms: number; at: number };
const samples: Sample[] = [];
let total = 0, success = 0, failure = 0;

export function recordSample(ok: boolean, ms: number) {
  total++;
  ok ? success++ : failure++;
  samples.push({ ok, ms, at: Date.now() });
  if (samples.length > 2000) samples.shift();
}

function percentile(arr: number[], p: number) {
  if (!arr.length) return 0;
  const idx = Math.floor((p / 100) * (arr.length - 1));
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted[idx];
}

export function metricsSummary() {
  const lat = samples.map(s => s.ms);
  const avg = lat.length ? Math.round(lat.reduce((a, b) => a + b, 0) / lat.length) : 0;
  const p95 = percentile(lat, 95);

  return {
    totalRequests: total,
    success,
    failure,
    successRate: total ? Math.round((success / total) * 100) : 0,
    avgLatencyMs: avg,
    p95LatencyMs: p95,
    windowSize: samples.length,
    lastReset: null
  };
}
