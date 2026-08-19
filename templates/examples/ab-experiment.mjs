import { inngest } from "../../src/inngest.js";
import { executeComposioTool } from "../../src/composio.js";
import { conn } from "../../src/connections.js";
import { mkdirSync, writeFileSync } from "node:fs";

// The core Shaun loop as ONE durable workflow. Trigger it with:
//   { experimentId, variants: [{ id, text }], evalWindow: "3d" }
//
// This is a skeleton: the Zernio argument shapes (marked TODO) need confirming
// against the real tool schemas. The durable STRUCTURE is the point, and it is
// correct: post variants, wait durably for the eval window, pull metrics, score,
// pick a winner, record it, and announce the result. If the Sprite sleeps for
// the whole three days, Inngest wakes it to finish.

export default inngest.createFunction(
  { id: "shaun-ab-experiment", name: "Shaun A/B Experiment", triggers: [{ event: "shaun/experiment.start" }] },
  async ({ event, step }) => {
    const { experimentId, variants = [], evalWindow = "3d" } = event.data ?? {};
    const z = conn("zernio_mcp");

    // 1. Post each variant. Each post is its own durable step.
    const posted = [];
    for (const v of variants) {
      const res = await step.run(`post-${v.id}`, async () =>
        executeComposioTool(
          "ZERNIO_MCP_POSTS_CREATE",
          { content: v.text /* TODO: confirm ZERNIO_MCP_POSTS_CREATE arg shape (content, account/profile, media) */ },
          z
        )
      );
      posted.push({ variantId: v.id, postId: res.data?.id ?? res.data?.postId ?? null, raw: res.successful });
    }

    // 2. Durable wait for the evaluation window. The Sprite can sleep the whole time.
    await step.sleep("eval-window", evalWindow);

    // 3. Pull metrics for each post (its own step).
    const scored = [];
    for (const p of posted) {
      const metrics = await step.run(`metrics-${p.variantId}`, async () =>
        executeComposioTool(
          "ZERNIO_MCP_ANALYTICS_GET_DAILY_METRICS",
          { postId: p.postId /* TODO: confirm the metrics arg shape */ },
          z
        )
      );
      // TODO: map the real metric fields. Placeholder scoring on engagement.
      const m = metrics.data ?? {};
      const score = Number(m.engagementRate ?? m.clicks ?? 0);
      scored.push({ ...p, score, metrics: m });
    }

    // 4. Pick the winner (lowest cost / highest engagement, per your rule).
    const winner = scored.slice().sort((a, b) => b.score - a.score)[0] ?? null;

    // 5. Record the experiment (the experiment log the reporter reads later).
    const record = { experimentId, evalWindow, variants: scored, winner, decidedAt: new Date().toISOString() };
    await step.run("record", async () => {
      const dir = new URL("../experiments/", import.meta.url);
      mkdirSync(dir, { recursive: true });
      writeFileSync(new URL(`${experimentId}.json`, dir), JSON.stringify(record, null, 2));
      return true;
    });

    // 6. Announce the result so the report function picks it up.
    await step.sendEvent("announce", {
      name: "shaun/experiment.done",
      data: { experimentId },
    });

    return record;
  }
);
