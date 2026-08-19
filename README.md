# Sprite Agent

A durable, self-authoring AI agent that runs on a Fly Sprite. Tools come from Composio (and direct MCP servers or CLIs), orchestration from Inngest, and the model through an AI Gateway. It authors its own durable functions, serves interactive pages at its own URL, and sleeps and wakes on demand.

## What you get

- An HTTP serve endpoint for Inngest durable functions at `/api/inngest`.
- A file watcher: drop a function into `workspace/functions/*.mjs` and it registers live.
- Composio tool execution wrapped in durable steps (`src/composio.js`).
- Remote MCP tool calls, also durable (`src/mcp.js`).
- A pages mechanism: `workspace/pages/*.html` is served at `/<name>`, and `POST /api/event` fires an Inngest event from a page.
- Per-deploy connection config (`workspace/connections.json`).

## Quickstart

See **SETUP.md** for the full recipe. In short:

```bash
cp .env.example .env                                          # fill your keys
cp workspace/connections.example.json workspace/connections.json
sprite create my-agent --skip-console
SPRITE=my-agent ./deploy.sh
sprite url update --auth public -s my-agent
```

## Local dev (no keys needed for the base loop)

```bash
npm install
npm run inngest:dev   # terminal 1: Inngest Dev Server
npm run serve:dev     # terminal 2: the serve app
npm run send          # terminal 3: fire a test event
```

## Docs

- `SETUP.md` — accounts, keys, deploy, connect apps, workflows, the ownership model.
- `DEPLOY-SPRITE.md` — Fly Sprite specifics.
- `INTEGRATION.md` — how other agents and apps integrate with a running instance.
- `templates/examples/` — reference durable workflows (A/B experiment, report).

## Notes

- Secrets live in `.env` and `workspace/connections.json`, both gitignored. Nothing sensitive is committed.
- The public routes (`/todo`, `/api/event`) have no auth by default. Add a token before real use.
