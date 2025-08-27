import 'dotenv/config';
import got from 'got';
import { HttpsProxyAgent } from 'https-proxy-agent';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name} in .env`);
  return v;
}

(async () => {
  const host = requireEnv('PROXY_HOST');
  const port = requireEnv('PROXY_PORT');
  const user = requireEnv('PROXY_USERNAME');
  const pass = requireEnv('PROXY_PASSWORD');

  const proxyUrl = `http://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}:${port}`;
  console.log('Testing proxy:', proxyUrl.replace(/:(?:[^@]*)@/, ':***@'));

  const agent = new HttpsProxyAgent(proxyUrl);

  try {
    const client = got.extend({
      agent: { https: agent },
      http2: false,
      timeout: { request: 15000 }
    });

    const res = await client.get('https://httpbin.org/ip', { responseType: 'text' });
    console.log('Proxy test succeeded!');
    console.log('Status code:', res.statusCode);
    console.log('Your IP through proxy:', res.body);
  } catch (e: any) {
    console.error('Proxy test FAILED:', e.message);
  }
})();
