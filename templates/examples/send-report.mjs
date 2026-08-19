import { inngest } from "../../src/inngest.js";
import { executeComposioTool } from "../../src/composio.js";
import { conn } from "../../src/connections.js";
import { readFileSync } from "node:fs";

// Emails the experiment result to Shaun via Outlook when an experiment finishes.
// Triggered by shaun/experiment.done (emitted by ab-experiment.mjs), or run it on
// a cron for a periodic digest. Reporting is a separate capability from the
// workflow that produced the data: this reads the record and narrates it.

export default inngest.createFunction(
  { id: "shaun-send-report", name: "Shaun Send Report", triggers: [{ event: "shaun/experiment.done" }] },
  async ({ event, step }) => {
    const { experimentId } = event.data ?? {};

    const record = await step.run("read-record", async () => {
      const url = new URL(`../experiments/${experimentId}.json`, import.meta.url);
      return JSON.parse(readFileSync(url, "utf8"));
    });

    // Turn the record into a plain-language report. (Swap for an LLM summary later.)
    const lines = (record.variants ?? [])
      .map((v) => `- Variant ${v.variantId}: score ${v.score}`)
      .join("\n");
    const body =
      `Experiment ${experimentId} finished.\n\n` +
      `${lines}\n\n` +
      `Winner: ${record.winner?.variantId ?? "none"}.\n`;

    await step.run("send-outlook", async () =>
      executeComposioTool(
        "OUTLOOK_SEND_MAIL", // TODO: confirm the exact Outlook send slug + arg shape
        {
          toRecipients: [{ emailAddress: { address: "shaun@example.com" } }], // TODO: Shaun's email
          subject: `AI Clinical Scribe: experiment ${experimentId} result`,
          body: { contentType: "Text", content: body },
        },
        conn("outlook")
      )
    );

    return { reported: experimentId };
  }
);
