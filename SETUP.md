# Client Agent Setup (Shaun's AI Clinical Scribe)

Deploy the Utah harness as a dedicated agent for one client. Utah is a self-authoring durable agent on a Fly Sprite: tools come from Composio, orchestration from Inngest, the model from the Vercel AI Gateway. This doc is the repeatable recipe. The same steps stand up any client.

Proven already: the harness deploys, wakes on HTTP, authors its own durable functions, and executes real Composio tools durably (Gmail fetch, Zernio account list). What remains for a given client is connecting their apps and writing the client's workflows.

---

## 1. Ownership model: the client owns their instance

Each client owns their own accounts and their own Sprite. You build and advise; you do NOT host their connections in your accounts. Two reasons: you cannot hold their app credentials inside your Composio project, and with no fee you should not carry their cost or liability. If you later run this as a paid hosted service you can flip to hosting it yourself, but the default is client-owned. This is also the cleaner long-term shape (Sprite per client, client owns it).

**Accounts the client signs up for (theirs):**

| Account | Gives | Notes |
|---|---|---|
| Fly / Sprites | the Sprite to run on | needs a card; compute is pennies |
| Inngest | `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` | free tier is plenty |
| Composio | `COMPOSIO_API_KEY` | their apps connect under their own project |
| A model key | `OPENAI_API_KEY` or `AI_GATEWAY_API_KEY` | their LLM spend |

**Their business accounts (they already have these):** WhatsApp Business, Outlook, the ad/social account. Connected via Composio (OAuth) under their Composio project, which yields a `connectedAccountId` (`ca_...`) and an entity/userId that go in `workspace/connections.json`. No per-app API keys to hunt.

**Their involvement beyond signup:** the offer and brand, copy approvals, an ad budget with hard caps, and their email for reports.

**Access:** to deploy onto their Fly org you need access, so either they invite you as an org member or you run the setup session together on their login.

---

## 2. The .env

Create `personal-apps/shaun-scribe-agent/.env` (gitignored):

```
AI_GATEWAY_API_KEY=...
COMPOSIO_API_KEY=...
INNGEST_EVENT_KEY=...
INNGEST_SIGNING_KEY=...
# optional: UTAH_MODEL=anthropic/claude-sonnet-4.5  (default openai/gpt-4o-mini)
```

`deploy.sh` reads these and carries them into the Sprite service. `INNGEST_SERVE_ORIGIN` is derived automatically from the Sprite URL, so you never set it.

---

## 3. Deploy a client instance (repeatable)

```bash
cd personal-apps/shaun-scribe-agent

# a) create the client's Sprite
sprite create shaun-scribe --skip-console

# b) deploy the harness to it (installs deps, runs the service, syncs Inngest)
SPRITE=shaun-scribe ./deploy.sh

# c) make the URL reachable so Inngest Cloud can POST to it
sprite url update --auth public -s shaun-scribe
sprite info -s shaun-scribe        # note the https://<name>-<org>.sprites.app URL
```

`deploy.sh` derives the origin, copies code, installs, restarts the `utah` service, and registers with Inngest Cloud. Re-run it any time you change harness code. Functions the agent wrote are preserved across redeploys.

---

## 4. Connect the client's apps (Composio)

For each app, connect an account in Composio (OAuth), then record the ids.

- In the Composio dashboard, connect **zernio_mcp**, **whatsapp**, and **outlook** for the client's accounts. Each returns a Connect Link the account owner clicks to authorize.
- Get the `connectedAccountId` and the owning entity/userId (all your current connections live under one entity; a client's will be their own).

Then fill `workspace/connections.json` (gitignored; copy from `connections.example.json`):

```json
{
  "userId": "<composio entity id>",
  "toolkits": {
    "gmail": "ca_...",
    "zernio_mcp": "ca_...",
    "whatsapp": "ca_...",
    "outlook": "ca_..."
  }
}
```

Functions read this through `conn("zernio_mcp")` etc., so no ids are hardcoded. Redeploy after editing it (`SPRITE=shaun-scribe ./deploy.sh`).

Sanity-check a connection with a read call, e.g. fire an event into a function that runs `executeComposioTool("ZERNIO_MCP_ACCOUNTS_LIST", {}, conn("zernio_mcp"))`. Success returns `successful: true` and a Composio `logId`.

---

## 5. The workflows

Reference implementations live in `templates/shaun/` (not auto-loaded). Copy the ones you want into `workspace/functions/` and redeploy; the watcher registers them.

- **`ab-experiment.mjs`** — the core loop, one durable workflow: post each content variant to Zernio, durably sleep the eval window (e.g. 3 days), pull daily metrics, score, pick a winner, write an experiment record, and emit `shaun/experiment.done`. The Sprite sleeps the whole window; Inngest wakes it to finish.
- **`send-report.mjs`** — triggered by `shaun/experiment.done`, reads the experiment record and emails Shaun the result via Outlook.

Both use real Composio slugs (`ZERNIO_MCP_POSTS_CREATE`, `ZERNIO_MCP_ANALYTICS_GET_DAILY_METRICS`, `OUTLOOK_SEND_MAIL`) but have `TODO`s where the exact argument shapes and the client's specifics (email, thresholds, creatives) need filling. Confirm a slug's arguments by running it once; Composio returns a clear validation error naming the missing field.

To run the loop:

```bash
# fire the experiment (via the Inngest event key, hits Inngest Cloud)
node -e "import('./src/inngest.js').then(m=>m.inngest.send({name:'shaun/experiment.start',data:{experimentId:'exp1',variants:[{id:'A',text:'...'},{id:'B',text:'...'}],evalWindow:'3d'}}))"
```

---

## 6. Constraints (from the spec)

- **WhatsApp templates are the long pole.** Outbound WhatsApp only on approved templates, and Meta approval takes time. Submit templates early (`WHATSAPP_CREATE_MESSAGE_TEMPLATE`), watch status (`WHATSAPP_GET_TEMPLATE_STATUS`), and don't gate the whole build on it.
- **Spend guardrails.** Hard caps on any ad account and card. Mock budgets for the first rounds. Money- and message-sending steps should be guarded so the model can't exceed them (approve-before-send via `step.waitForEvent`).
- **Number warm-up.** Ramp WhatsApp volume; never a cold blast.

---

## 7. What's proven vs still TODO

Proven: harness deploy, sleep/wake, self-authoring functions, durable Composio calls for a normal toolkit (Gmail) and an MCP toolkit (Zernio).

TODO for Shaun: connect WhatsApp + Outlook accounts; confirm the Zernio/WhatsApp/Outlook argument shapes; fill the client specifics in the workflow templates; submit WhatsApp templates; add the approval gate before any spend.
