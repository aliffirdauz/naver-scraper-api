// scripts/test-proxy.ts
import 'dotenv/config';
import net from 'node:net';
import tls from 'node:tls';
import { URL } from 'node:url';

function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name} in .env`);
  return v;
}

const HOST = env('PROXY_HOST');
const PORT = Number(env('PROXY_PORT'));
const USER = env('PROXY_USERNAME');
const PASS = env('PROXY_PASSWORD');
const SCHEME = (process.env.PROXY_SCHEME || 'http').toLowerCase(); // 'http' atau 'https'
const TARGET_HOST = 'httpbin.org';
const TARGET_PORT = 443;

(async () => {
  console.log(`Proxy: ${SCHEME}://${HOST}:${PORT} as ${USER}:***`);
  console.log(`Target: ${TARGET_HOST}:${TARGET_PORT}`);

  // 1) buat koneksi TCP ke proxy
  const socket = net.connect(PORT, HOST);
  await new Promise<void>((resolve, reject) => {
    socket.once('connect', () => resolve());
    socket.once('error', reject);
  });

  // 2) kalau SCHEME=https, bungkus socket dengan TLS dulu (TLS ke PROXY, bukan ke target)
  let upstream: net.Socket | tls.TLSSocket = socket;
  if (SCHEME === 'https') {
    upstream = tls.connect({ socket, servername: HOST }, () => {
      /* connected TLS to proxy */
    });
    await new Promise<void>((resolve, reject) => {
      (upstream as tls.TLSSocket).once('secureConnect', () => resolve());
      upstream.once('error', reject);
    });
  }

  // 3) kirim CONNECT
  const auth = Buffer.from(`${USER}:${PASS}`).toString('base64');
  const connectReq =
    `CONNECT ${TARGET_HOST}:${TARGET_PORT} HTTP/1.1\r\n` +
    `Host: ${TARGET_HOST}:${TARGET_PORT}\r\n` +
    `Proxy-Authorization: Basic ${auth}\r\n` +
    `Proxy-Connection: Keep-Alive\r\n\r\n`;
  upstream.write(connectReq);

  // 4) baca respons CONNECT
  const head = await new Promise<string>((resolve, reject) => {
    let buf = '';
    const onData = (chunk: Buffer) => {
      buf += chunk.toString('latin1');
      if (buf.includes('\r\n\r\n')) {
        upstream.off('data', onData);
        resolve(buf);
      }
    };
    upstream.on('data', onData);
    upstream.once('error', reject);
    setTimeout(() => reject(new Error('CONNECT timeout')), 8000);
  });

  console.log('--- CONNECT response head ---');
  console.log(head.split('\r\n').slice(0, 5).join('\n'));
  console.log('-----------------------------');

  if (!/^HTTP\/1\.[01] 200/i.test(head)) {
    throw new Error('CONNECT failed (bukan 200). Cek kredensial atau skema proxy.');
  }

  // 5) lakukan TLS ke TARGET melalui tunnel
  const secure = tls.connect({
    socket: upstream as net.Socket,
    servername: TARGET_HOST
  });

  await new Promise<void>((resolve, reject) => {
    secure.once('secureConnect', () => resolve());
    secure.once('error', reject);
  });

  // 6) kirim GET /ip (HTTP/1.1) ke target
  const req =
    `GET /ip HTTP/1.1\r\n` +
    `Host: ${TARGET_HOST}\r\n` +
    `User-Agent: curl/8\r\n` +
    `Accept: */*\r\n\r\n`;
  secure.write(req);

  // 7) baca beberapa baris respons
  const resp = await new Promise<string>((resolve, reject) => {
    let buf = '';
    const onData = (chunk: Buffer) => {
      buf += chunk.toString('utf8');
      if (buf.includes('\r\n\r\n')) {
        secure.off('data', onData);
        resolve(buf);
      }
    };
    secure.on('data', onData);
    secure.once('error', reject);
    setTimeout(() => reject(new Error('Target response timeout')), 8000);
  });

  console.log('--- Target response head ---');
  console.log(resp.split('\r\n').slice(0, 8).join('\n'));
  console.log('----------------------------');

  secure.destroy();
  upstream.destroy();
  console.log('OK: tunnel & TLS ke target sukses.');
})().catch((e) => {
  console.error('TEST FAILED:', e.message);
  process.exit(1);
});
