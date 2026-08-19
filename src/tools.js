import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tool } from "ai";
import { z } from "zod";
import { inngest } from "./inngest.js";
import { executeComposioTool } from "./composio.js";

const FN_DIR = new URL("../workspace/functions/", import.meta.url);

// The agent's hands. Plain functions the agent calls; the agent wraps every call
// in step.run so the whole loop is durable and retryable.

export function listFunctions() {
  try {
    return readdirSync(FN_DIR)
      .filter((f) => f.endsWith(".mjs"))
      .map((f) => f.replace(/\.mjs$/, ""));
  } catch {
    return [];
  }
}

export function readFunction(name) {
  return readFileSync(new URL(`${name}.mjs`, FN_DIR), "utf8");
}

export function writeFunction(name, code) {
  mkdirSync(FN_DIR, { recursive: true });
  writeFileSync(new URL(`${name}.mjs`, FN_DIR), code);
  return `wrote ${name}.mjs (the watcher will register it within ~1s)`;
}

export function deleteFunction(name) {
  rmSync(new URL(`${name}.mjs`, FN_DIR));
  return `deleted ${name}.mjs`;
}

export async function sendEvent(name, data) {
  const res = await inngest.send({ name, data: data ?? {} });
  return { sent: name, ids: res.ids };
}

// Dispatch used by the agent loop after the model asks for a tool.
export async function runTool(toolName, input) {
  const args = input ?? {};
  switch (toolName) {
    case "list_functions":
      return listFunctions();
    case "read_function":
      return readFunction(args.name);
    case "write_function":
      return writeFunction(args.name, args.code);
    case "delete_function":
      return deleteFunction(args.name);
    case "send_event":
      return await sendEvent(args.name, args.data);
    case "composio_execute":
      return await executeComposioTool(args.slug, args.arguments, {
        userId: args.userId,
        connectedAccountId: args.connectedAccountId,
      });
    default:
      return `unknown tool: ${toolName}`;
  }
}

// AI SDK tool definitions. No `execute` on purpose: the SDK returns the tool
// calls and the agent runs each one inside its own Inngest step, so we keep
// per-tool durability instead of letting the SDK run the loop opaquely.
export const tools = {
  list_functions: tool({
    description: "List the Inngest functions currently in the workspace.",
    inputSchema: z.object({}),
  }),
  read_function: tool({
    description: "Read the source of one workspace function.",
    inputSchema: z.object({ name: z.string() }),
  }),
  write_function: tool({
    description:
      "Create or overwrite a workspace function file (.mjs). It registers automatically.",
    inputSchema: z.object({
      name: z.string().describe("file name without extension"),
      code: z.string().describe("full ESM source of the file"),
    }),
  }),
  delete_function: tool({
    description: "Delete a workspace function file.",
    inputSchema: z.object({ name: z.string() }),
  }),
  send_event: tool({
    description: "Fire an Inngest event. Any function triggered by that name runs durably.",
    inputSchema: z.object({
      name: z.string(),
      data: z.record(z.string(), z.any()).optional(),
    }),
  }),
  composio_execute: tool({
    description:
      "Execute a Composio tool by its slug to act on a real app (e.g. GITHUB_GET_REPOS, HACKERNEWS_GET_USER, GMAIL_FETCH_EMAILS). Do not guess slugs; use known ones. If the app needs auth and the user isn't connected, the result will say a connection is required.",
    inputSchema: z.object({
      slug: z.string().describe("the Composio tool slug, uppercase"),
      arguments: z.record(z.string(), z.any()).optional(),
      userId: z.string().optional().describe("defaults to 'default'"),
      connectedAccountId: z
        .string()
        .optional()
        .describe("target a specific connected account for an authenticated app"),
    }),
  }),
};
