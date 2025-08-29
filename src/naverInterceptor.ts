import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { Cluster } from "puppeteer-cluster";

puppeteer.use(StealthPlugin());

let cluster: Cluster<any, any> | null = null;

export async function initCluster() {
  if (cluster) return cluster;

  cluster = await Cluster.launch({
    puppeteer,
    concurrency: Cluster.CONCURRENCY_PAGE,
    maxConcurrency: 5,
    puppeteerOptions: {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--proxy-server=6n8xhsmh.as.thordata.net:9999",
      ],
    },
  });

  await cluster.task(
    async ({ page, data: apiUrl }: { page: any; data: string }) => {
      // Auth proxy
      await page.authenticate({
        username: "td-customer-mrscraperTrial-country-kr",
        password: "P3nNRQ8C2",
      });

      // Tambahin header mirip cURL lo
      await page.setExtraHTTPHeaders({
        accept: "*/*",
        "accept-language": "en-US,en;q=0.9",
        "content-type": "application/json",
        dnt: "1",
        referer:
          "https://search.shopping.naver.com/ns/search?query=iphone&score=4.8%7C5",
        "user-agent":
          "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36 Edg/139.0.0.0",
      });

      // Tambahin cookies (kalau perlu hardcode dari cURL)
      await page.setCookie(
        { name: "NNB", value: "IHI3QG5SW2VGQ", domain: ".naver.com" },
        { name: "NAC", value: "l2n3BcQFQesiA", domain: ".naver.com" },
        {
          name: "nstore_session",
          value: "EIqwRigKNRfjo29nXqi40vZy",
          domain: ".naver.com",
        }
        // tambahin cookie lain sesuai cURL lo
      );

      // Langsung fetch API target
      const response = await page.goto(apiUrl, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });

      if (!response) throw new Error("No response from Naver");
      const json = await response.json();
      return json;
    }
  );

  return cluster;
}

export async function scrapeNaver(apiUrl: string) {
  if (!cluster)
    throw new Error("Cluster not initialized. Call initCluster first.");
  return await cluster.execute(apiUrl);
}
