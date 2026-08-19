import { readFileSync } from "node:fs";
import { generateText } from "ai";
import { inngest } from "./inngest.js";
import { tools, runTool } from "./tools.js";
import { pickModel } from "./model.js";

// Utah. The brain that wakes when a message arrives, decides, and acts through
// tools. Provider-agnostic: the model is a Vercel AI Gateway string chosen by
// pickModel(), so switching models (or adding a task router) never touches this
// loop. Every model call and every tool call is its own step.run, so the whole
// think/act loop is durable: if the Sprite dies mid-loop, Inngest resumes from
// the last completed step instead of starting over.

function soul() {
  try {
    return readFileSync(new URL("../workspace/SOUL.md", import.meta.url), "utf8");
  } catch {
    return "You are Utah, a durable workflow agent running on a Fly Sprite.";
  }
}

const MAX_TURNS = 8;

export default inngest.createFunction(
  { id: "utah-agent", name: "Utah Agent", triggers: [{ event: "agent.message.received" }] },
  async ({ event, step }) => {
    const message = String(event.data?.message ?? "");
    const messages = [{ role: "user", content: message }];

    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const res = await step.run(`llm-${turn}`, async () => {
        const r = await generateText({
          model: pickModel({ message, turn }),
          system: soul(),
          messages,
          tools,
        });
        return {
          text: r.text,
          toolCalls: r.toolCalls ?? [],
          responseMessages: r.response.messages,
        };
      });

      // Append the assistant's turn (in the SDK's own message shape).
      messages.push(...res.responseMessages);

      // No tool calls means the model is done and this is its reply.
      if (res.toolCalls.length === 0) {
        return { reply: res.text, turns: turn + 1 };
      }

      // Run each requested tool as its own durable step, feed results back.
      for (const call of res.toolCalls) {
        const output = await step.run(`tool-${turn}-${call.toolName}`, async () =>
          runTool(call.toolName, call.input)
        );
        messages.push({
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId: call.toolCallId,
              toolName: call.toolName,
              output: { type: "json", value: output },
            },
          ],
        });
      }
    }

    return { reply: "stopped after max turns", turns: MAX_TURNS };
  }
);
