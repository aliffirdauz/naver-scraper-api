import express from "express";
import { initCluster, scrapeNaver } from "./naverInterceptor";

const app = express();

app.get("/naver", async (req, res) => {
  const { url } = req.query;
  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "Missing query param `url`" });
  }

  try {
    await initCluster();
    const data = await scrapeNaver(url);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => {
  console.log("✅ API running at http://localhost:3000");
});