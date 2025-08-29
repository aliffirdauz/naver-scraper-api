import axios from "axios";
import { HttpsProxyAgent } from "https-proxy-agent";
import dotenv from "dotenv";

dotenv.config();

export async function checkProxy() {
  const proxyHost = process.env.PROXY_HOST;
  const proxyPort = process.env.PROXY_PORT;
  const proxyUser = process.env.PROXY_USER;
  const proxyPass = process.env.PROXY_PASS;

  if (!proxyHost || !proxyPort || !proxyUser || !proxyPass) {
    console.error("❌ Proxy config missing in .env");
    return;
  }

  const proxyUrl = `http://${proxyUser}:${proxyPass}@${proxyHost}:${proxyPort}`;
  const agent = new HttpsProxyAgent(proxyUrl);

  try {
    const res = await axios.get("https://httpbin.org/ip", {
      httpsAgent: agent,
      timeout: 10000,
    });

    console.log("✅ Proxy is working");
    console.log("Your proxy IP:", res.data.origin);
  } catch (err: any) {
    if (err.response) {
      console.error("❌ Proxy failed:", err.response.status, err.response.statusText);
      console.error("Response body:", err.response.data);
    } else {
      console.error("❌ Proxy failed:", err.message);
    }
  }
}
