import express from "express";
import { initCluster, scrapeNaver } from "./naverInterceptor";

const app = express();

app.get("/naver", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "Missing query param `url`" });

  try {
    const data = await scrapeNaver(String(url));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

(async () => {
  await initCluster();
  app.listen(3000, () => console.log("API running at http://localhost:3000"));
})();
