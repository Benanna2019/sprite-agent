import { Composio } from "@composio/core";

// Direct-execution Composio client. We deliberately do NOT use the Vercel
// provider's auto-executing tools, because that runs the whole tool loop inside
// a single generateText call and throws away per-step durability. Instead we
// call composio.tools.execute() ourselves and wrap it in an Inngest step.run,
// so every external tool call is a durable, retryable step. That is the point.
//
// Lazily constructed so the server still boots when COMPOSIO_API_KEY is absent
// (local dev); it only errors when a Composio tool is actually called.
let _composio;
export function composio() {
  return (_composio ??= new Composio()); // reads COMPOSIO_API_KEY from env
}

// Execute one Composio tool by slug. userId is required for no-auth tools and
// scopes auth for connected apps. Returns the provider result plus a Composio
// log id. If the app needs auth and the user isn't connected, the result says so.
// opts is either a userId string (no-auth or user-scoped) or
// { userId } / { connectedAccountId }. Authenticated apps resolve by whichever
// you pass; a connectedAccountId targets one specific connection directly.
export async function executeComposioTool(slug, args, opts = {}) {
  const { userId, connectedAccountId } =
    typeof opts === "string" ? { userId: opts } : opts;
  const body = {
    arguments: args ?? {},
    // Use the latest tool version without a per-toolkit pin. Fine for a dynamic
    // agent that discovers tools at runtime; a fixed product would pin versions.
    dangerouslySkipVersionCheck: true,
  };
  // Authenticated tools need the owning user id (entity). When a
  // connectedAccountId is given, Composio still requires the matching userId, so
  // pass both. No-auth tools fall back to "default".
  if (userId) body.userId = userId;
  if (connectedAccountId) body.connectedAccountId = connectedAccountId;
  if (!userId && !connectedAccountId) body.userId = "default";
  return composio().tools.execute(slug, body);
}
