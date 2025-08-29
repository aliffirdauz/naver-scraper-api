import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { Cluster } from "puppeteer-cluster";
import dotenv from "dotenv";

dotenv.config();
puppeteer.use(StealthPlugin());

let cluster: Cluster<any, any> | null = null;

function buildSearchRefererFromApiUrl(apiUrl: string): string {
  // Ambil ?query= dari URL API untuk dijadikan referer page
  try {
    const u = new URL(apiUrl);
    const q = u.searchParams.get("query") || "";
    // score kalau ada, ikutkan biar AB-test/variant sama
    const score = u.searchParams.get("score");
    const scoreParam = score ? `&score=${encodeURIComponent(score)}` : "";
    return `https://search.shopping.naver.com/ns/search?query=${encodeURIComponent(q)}${scoreParam}`;
  } catch {
    // fallback generic
    return `https://search.shopping.naver.com/ns/search?query=iphone`;
  }
}

export async function initCluster() {
  if (cluster) return cluster;

  cluster = await Cluster.launch({
    puppeteer,
    concurrency: Cluster.CONCURRENCY_PAGE,
    maxConcurrency: 3,
    puppeteerOptions: {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        `--proxy-server=${process.env.PROXY_HOST}:${process.env.PROXY_PORT}`,
      ],
    },
    timeout: 5 * 60 * 1000,
    monitor: false,
  });

  // Task: buka referer, tunggu cookie token muncul, lalu fetch API target di context halaman
  await cluster.task(async ({ page, data: apiUrl }: { page: any; data: string }) => {
    // Proxy auth
    if (process.env.PROXY_USER && process.env.PROXY_PASS) {
      await page.authenticate({
        username: process.env.PROXY_USER!,
        password: process.env.PROXY_PASS!,
      });
    }

    // Minimal headers: UA + language (sec-ch-* bakal diinject otomatis sama browser)
    await page.setExtraHTTPHeaders({
      "accept-language": "en-US,en;q=0.9,ko-KR;q=0.8",
      "user-agent":
        "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36",
    });

    // Optional: block gambar/font buat ngebut
    // @ts-ignore
    if (page.route) {
      // Puppeteer v22+
      // @ts-ignore
      await page.route("**/*", (route: any) => {
        const type = route.request().resourceType();
        if (type === "image" || type === "font" || type === "media") route.abort();
        else route.continue();
      });
    }

    // 1) Buka referer page di origin yang sama biar JS Naver nyuntik cookie/token baru
    const referer = buildSearchRefererFromApiUrl(apiUrl);
    await page.goto(referer, { waitUntil: "domcontentloaded", timeout: 60000 });

    // 2) Tunggu cookie token dinamis muncul (X-Wtm-Cpt-Tk dkk)
    await page.waitForFunction(
      () => document.cookie.includes("X-Wtm-Cpt-Tk="),
      { timeout: 20000 }
    ).catch(() => {}); // kalau gak ada, tetap lanjut — kadang gak wajib

    // 3) Fetch API target dari dalam page (same-origin, credentials include)
    const result = await page.evaluate(async (targetUrl: string | URL | Request) => {
      const res = await fetch(targetUrl, {
        method: "GET",
        credentials: "include",
        headers: {
          "accept": "*/*",
          "content-type": "application/json",
        },
      });
      // kadang 200 tapi body kosong → tetap balikin text buat debug
      const text = await res.text();
      try { return JSON.parse(text); } catch { return { __raw: text, status: res.status }; }
    }, apiUrl);

    // Validasi minimal
    if (!result) throw new Error("Empty result");
    return result;
  });

  return cluster;
}

export async function scrapeNaver(apiUrl: string) {
  if (!cluster) throw new Error("Cluster not initialized. Call initCluster first.");
  return cluster.execute(apiUrl);
}
