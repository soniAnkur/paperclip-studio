// Vercel serverless function for the public live demo: always demo data,
// no Paperclip instance, no credentials, nothing to fetch.
import { DEMO_SUMMARY } from "../mockData.mjs";

export default function handler(req, res) {
  res.setHeader("cache-control", "no-store");
  res.status(200).json(DEMO_SUMMARY);
}
