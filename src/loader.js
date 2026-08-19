import { readdirSync } from "node:fs";

// Load every function file the agent has written into workspace/functions/.
// Each file default-exports an Inngest function (or an array of them).
// This is the "file on disk is the deploy" piece from the spec.
//
// The ?v= cache-buster forces a fresh import after an edit, since Node caches
// dynamic imports by URL. Without it, a changed file would keep its old code.
export async function loadFunctions() {
  const dir = new URL("../workspace/functions/", import.meta.url);
  let files = [];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".mjs"));
  } catch {
    files = [];
  }
  const fns = [];
  for (const f of files) {
    const href = new URL(f, dir).href + `?v=${Date.now()}`;
    try {
      const mod = await import(href);
      const exp = mod.default ?? mod.fn;
      if (Array.isArray(exp)) fns.push(...exp);
      else if (exp) fns.push(exp);
    } catch (err) {
      console.error(`[loader] skipped ${f}: ${err.message}`);
    }
  }
  return fns;
}
