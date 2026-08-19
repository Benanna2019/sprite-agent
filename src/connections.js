import { readFileSync } from "node:fs";

// Per-client Composio wiring, read from workspace/connections.json (which is
// per-deploy and gitignored). This is what makes the harness a template: the
// code never hardcodes a client's entity or connected-account ids.
//
// Shape of workspace/connections.json:
//   {
//     "userId": "<composio entity / user id that owns the connections>",
//     "toolkits": {
//       "gmail": "ca_...",
//       "zernio_mcp": "ca_...",
//       "whatsapp": "ca_...",
//       "outlook": "ca_..."
//     }
//   }
let _cfg;
export function connections() {
  if (_cfg) return _cfg;
  try {
    _cfg = JSON.parse(
      readFileSync(new URL("../workspace/connections.json", import.meta.url), "utf8")
    );
  } catch {
    _cfg = { userId: "default", toolkits: {} };
  }
  return _cfg;
}

// Resolve the { userId, connectedAccountId } to pass to executeComposioTool for
// a given toolkit slug (e.g. conn("zernio_mcp")).
export function conn(toolkit) {
  const c = connections();
  return { userId: c.userId, connectedAccountId: c.toolkits?.[toolkit] };
}
