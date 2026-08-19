import { inngest } from "../../src/inngest.js";
import { mkdirSync, appendFileSync } from "node:fs";

// Catches the event the todo app fires, so we can see it land durably.
// This is where a real focus workflow (sequence, check-ins, email) would go.
export default inngest.createFunction(
  { id: "todo-logger", name: "Todo Logger", triggers: [{ event: "todo/item.done" }] },
  async ({ event, step }) => {
    await step.run("log", async () => {
      const dir = new URL("../results/", import.meta.url);
      mkdirSync(dir, { recursive: true });
      appendFileSync(
        new URL("todo-log.txt", dir),
        `${new Date().toISOString()}  done: ${JSON.stringify(event.data)}\n`
      );
      return true;
    });
    return { logged: event.data };
  }
);
