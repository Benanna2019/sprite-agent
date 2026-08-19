import "dotenv/config";
import express from "express";
import { serve } from "inngest/express";
import chokidar from "chokidar";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { inngest } from "./inngest.js";
import { loadFunctions } from "./loader.js";
import agent from "./agent.js";

// This is the whole thing that lives on the Sprite: one Node process that
//  1. serves Inngest over HTTP (so Cloud's inbound request is the wake), and
//  2. watches workspace/functions and re-registers on change (the sidecar).
// HTTP serve mode, NOT connect(), because a sleeping Sprite drops a WebSocket.

const port = process.env.PORT || 3939;

async function buildHandler() {
  const workspaceFns = await loadFunctions();
  const functions = [agent, ...workspaceFns];
  console.log(`[serve] registered agent + ${workspaceFns.length} workspace function(s)`);
  // serveHost pins the URL the app advertises to Inngest Cloud. Without it, a
  // self-sync PUT from the watcher (which hits localhost) would register the app
  // as localhost and Cloud could no longer reach it. In local dev it's unset and
  // the SDK falls back to the request host, which is correct there.
  return serve({
    client: inngest,
    functions,
    serveHost: process.env.INNGEST_SERVE_ORIGIN || process.env.INNGEST_SERVE_HOST,
    servePath: process.env.INNGEST_SERVE_PATH || "/api/inngest",
  });
}

// A mutable handler so we can hot-swap the function set without restarting.
let handler = await buildHandler();

const app = express();
app.use(express.json({ limit: "5mb" })); // tool results (e.g. email fetches) can be large
app.get("/", (_req, res) => res.type("text").send("Utah on the Sprite is up."));

// Serve pages the agent (or we) drop into workspace/pages/. GET /todo -> todo.html
app.get("/:page", (req, res, next) => {
  if (req.params.page.startsWith("api")) return next();
  try {
    const html = readFileSync(
      new URL(`../workspace/pages/${req.params.page}.html`, import.meta.url),
      "utf8"
    );
    res.type("html").send(html);
  } catch {
    next();
  }
});

// Fire an Inngest event from a page. The button in the app POSTs here.
app.post("/api/event", async (req, res) => {
  const { name, data } = req.body ?? {};
  if (!name) return res.status(400).json({ error: "name required" });
  try {
    const r = await inngest.send({ name, data: data ?? {} });
    res.json({ ok: true, ids: r.ids });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.use("/api/inngest", (req, res, next) => handler(req, res, next));
app.listen(port, () => console.log(`[serve] listening on :${port}`));

// Live reload. A new or changed file in workspace/functions is the deploy.
const watchDir = fileURLToPath(new URL("../workspace/functions/", import.meta.url));
let debounce;
chokidar.watch(watchDir, { ignoreInitial: true }).on("all", (evt, path) => {
  clearTimeout(debounce);
  debounce = setTimeout(async () => {
    console.log(`[watch] ${evt} ${path} -> reloading functions`);
    handler = await buildHandler();
    // Re-sync with Inngest by PUTing our own endpoint (the SDK registers on PUT).
    try {
      await fetch(`http://localhost:${port}/api/inngest`, { method: "PUT" });
    } catch (err) {
      console.error(`[watch] re-sync failed: ${err.message}`);
    }
  }, 400);
});
