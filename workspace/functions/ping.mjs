import { inngest } from "../../src/inngest.js";
import { mkdirSync, writeFileSync } from "node:fs";

// The "ping works" milestone from the spec. Three durable steps, then it writes
// a result file so we can confirm the run happened without watching a dashboard.
export default inngest.createFunction(
  { id: "ping", name: "Ping", triggers: [{ event: "agent/ping" }] },
  async ({ event, step }) => {
    const who = await step.run("read-input", async () => event.data?.name ?? "world");

    const stamped = await step.run(
      "stamp",
      async () => `pong for ${who} at ${new Date().toISOString()}`
    );

    await step.run("write-result", async () => {
      const dir = new URL("../results/", import.meta.url);
      mkdirSync(dir, { recursive: true });
      writeFileSync(new URL("ping.json", dir), JSON.stringify({ who, stamped }, null, 2));
      return true;
    });

    return { stamped };
  }
);
