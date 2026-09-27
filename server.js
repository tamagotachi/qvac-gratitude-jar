// Gratitude Jar - an AI on YOUR machine (QVAC) gives you a new gratitude prompt every day. Save your answer,
// keep a streak, and shake the jar to revisit an old entry. Open http://localhost:3099 after starting.

import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

// The QVAC worker can be slow to start on some computers. Wait up to 3 minutes for it.
process.env.QVAC_RPC_INIT_TIMEOUT_MS ??= "180000";
const { loadModel, completion, LLAMA_3_2_1B_INST_Q4_0 } = await import("@qvac/sdk");

const PORT = 3099;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---- Step 1: load the AI model (downloads the first time, then it's cached) ----
let modelId = null;
const status = { ready: false, message: "Starting...", percent: null, error: null };
async function startModel() {
  try {
    status.message = "Loading the AI model (first run downloads it)...";
    modelId = await loadModel({
      modelSrc: LLAMA_3_2_1B_INST_Q4_0,
      modelType: "llm",
      onProgress: (p) => { const v = typeof p === "number" ? p : p?.percentage; if (typeof v === "number") status.percent = Math.round(v); },
    });
    status.ready = true; status.message = "AI prompt writer ready";
    console.log("Model loaded. Open http://localhost:" + PORT);
  } catch (err) { status.error = String(err?.message || err); console.error("Could not load model:", err); }
}

// One AI job at a time
let chain = Promise.resolve();
const enqueue = (job) => { const p = chain.then(job); chain = p.catch(() => {}); return p; };

function readBody(req, limit = 10000) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => { data += c; if (data.length > limit) { reject(new Error("Too big")); req.destroy(); } });
    req.on("end", () => resolve(data)); req.on("error", reject);
  });
}
const json = (res, code, obj) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(obj)); };
const clean = (v, n) => String(v || "").replace(/\s+/g, " ").trim().slice(0, n);

// QVAC "structured output": a single warm prompt.
const SCHEMA = { type: "object", properties: { prompt: { type: "string" } }, required: ["prompt"], additionalProperties: false };
const SYSTEM_PROMPT = `You write gratitude journal prompts. Reply with JSON only.
prompt: one warm, specific question (one sentence) that helps someone notice something good in their life today.
Vary the focus: people, small moments, senses, challenges that taught something, nature, or things they take for granted.
Gentle and positive, suitable for all ages. Never repeat a prompt already used.`;

// ---- Step 2: the web server ----
const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(await readFile(path.join(__dirname, "public", "index.html")));
    }
    if (req.method === "GET" && req.url === "/api/status") return json(res, 200, status);
    if (req.method === "POST" && req.url === "/api/prompt") {
      if (!status.ready) return json(res, 503, { error: "The AI prompt writer is not ready yet." });
      const b = JSON.parse(await readBody(req)), avoid = (Array.isArray(b.avoid) ? b.avoid : []).map((x) => clean(x, 200)).filter(Boolean).slice(-30);
      const r = await enqueue(async () => {
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            // This is the QVAC call that runs the AI on-device
            const run = completion({ modelId, stream: true, history: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: avoid.length ? "Prompts already used, don't repeat:\n- " + avoid.join("\n- ") : "No prompts used yet." }], responseFormat: { type: "json_schema", json_schema: { name: "Prompt", schema: SCHEMA } } });
            let out = "";
            for await (const event of run.events) if (event.type === "contentDelta") out += event.text;
            const p = clean(JSON.parse(out).prompt, 200);
            if (p && p.length > 10 && !avoid.some((a) => a.toLowerCase() === p.toLowerCase())) return p;
          } catch (err) { console.error("Prompt attempt failed:", err.message); }
        }
        return null;
      });
      return r ? json(res, 200, { prompt: r }) : json(res, 502, { error: "The AI couldn't write a prompt. Try again." });
    }
    res.writeHead(404); res.end("Not found");
  } catch (err) { console.error(err); json(res, 500, { error: String(err?.message || err) }); }
});

// "127.0.0.1" means only YOUR computer can reach this app
server.listen(PORT, "127.0.0.1", () => console.log("Server running at http://localhost:" + PORT));
startModel();
