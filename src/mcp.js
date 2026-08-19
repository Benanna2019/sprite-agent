import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

// Call a tool on a remote MCP server (the "direct MCP" tool source, for services
// that ship their own MCP like Higgs or Artlist). Connect, call, close per
// invocation so it slots cleanly into an Inngest step.run and stays durable.
//
// For servers that need auth, pass headers (e.g. { Authorization: "Bearer ..." }).
export async function callMcpTool({ url, name, arguments: args = {}, headers }) {
  const client = new Client({ name: "utah", version: "0.0.1" }, { capabilities: {} });
  const transport = new StreamableHTTPClientTransport(
    new URL(url),
    headers ? { requestInit: { headers } } : undefined
  );
  await client.connect(transport);
  try {
    return await client.callTool({ name, arguments: args });
  } finally {
    await client.close();
  }
}

// List the tools a remote MCP server exposes (handy for discovery).
export async function listMcpTools({ url, headers }) {
  const client = new Client({ name: "utah", version: "0.0.1" }, { capabilities: {} });
  const transport = new StreamableHTTPClientTransport(
    new URL(url),
    headers ? { requestInit: { headers } } : undefined
  );
  await client.connect(transport);
  try {
    const { tools } = await client.listTools();
    return tools.map((t) => t.name);
  } finally {
    await client.close();
  }
}
