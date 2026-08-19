# Deploying Utah on a Fly Sprite

A Sprite is a persistent Linux computer, not a container image. You put the code
on it and run the server as a "service" that the Sprite runtime keeps alive and
wakes on HTTP. HTTP routes to the service's port and cold-starts it in 1-2s.

Note: the `Dockerfile` and `fly.toml` in this repo are the plain Fly *Machines*
pattern and are NOT used for Sprites. Sprites persists the filesystem natively,
so `workspace/` just survives across sleeps; no volume seeding needed.

## Prereqs

- A Sprites account (`sprites.dev`).
- An Inngest Cloud account, for the event key and signing key.
- Your `AI_GATEWAY_API_KEY`.

## 1. Install and auth (interactive, run these yourself)

```bash
curl -fsSL https://sprites.dev/install.sh | sh
sprite org auth
```

## 2. Create the Sprite

```bash
sprite create shaun-scribe
sprite use shaun-scribe          # writes a local .sprite context file
```

## 3. Get the code onto it

Cleanest is git. From a shell on the Sprite:

```bash
sprite console
# now inside the Sprite:
cd /home/sprite
git clone <your-repo-url> app && cd app/personal-apps/shaun-scribe-agent
# install a Node 22 runtime if not present, then:
npm install
exit
```

No repo yet? Copy the folder up instead (from your Mac, in this directory):

```bash
tar czf - --exclude node_modules . | sprite exec -- bash -c "mkdir -p /home/sprite/app && cd /home/sprite/app && tar xzf -"
sprite exec --dir /home/sprite/app -- npm install
```

## 4. Run the server as a service on port 8080

The Sprite routes its public URL to `--http-port`, and starts the service on the
first request if it is asleep. Set production env here (NOT `INNGEST_DEV`).

```bash
sprite-env services create utah \
  --cmd /.sprite/bin/node --args "src/server.js" \
  --dir /home/sprite/app \
  --http-port 8080 \
  --env "PORT=8080,INNGEST_SERVE_ORIGIN=https://<your-sprite-url>.sprites.app,INNGEST_SERVE_PATH=/api/inngest,AI_GATEWAY_API_KEY=xxx,INNGEST_EVENT_KEY=xxx,INNGEST_SIGNING_KEY=xxx"
```

`INNGEST_SERVE_ORIGIN` is required, not optional. Without it, when the watcher
re-registers a newly written function it self-syncs over localhost, and the SDK
would register the app's URL as `localhost`, which Inngest Cloud cannot reach.
Pinning the origin makes every sync advertise the real public URL. (Our server
already respects `PORT`, so `PORT=8080` is all it needs beyond that.)

Manage it later with `sprite-env services list | restart utah | stop utah`.

## 5. Make the URL public so Inngest can reach it

By default the Sprite URL requires a Sprite token. Inngest Cloud must be able to
POST to it, so open it:

```bash
sprite url update --auth public
sprite info                      # shows https://shaun-scribe-<org-id>.sprites.app
```

Your Inngest endpoint is that URL + `/api/inngest`.

## 6. Register the app with Inngest Cloud

In the Inngest dashboard: create an app / "Sync new app" and paste
`https://shaun-scribe-<org-id>.sprites.app/api/inngest`. Create the event key and
signing key there; they must match the ones in the service `--env` above. Syncing
wakes the Sprite and reads its function list.

## 7. Test

Send `agent.message.received` with `{ "message": "list my functions" }` from the
Inngest dashboard (or with the event key). Inngest POSTs the Sprite URL, the
Sprite wakes, Utah runs, and you see a durable run in the dashboard.

## How the sleep/wake matches the spec

Idle Sprite sleeps. Inngest needs to run a step (a message, a cron, the end of a
three-day `step.sleep`) and POSTs the Sprite URL. The proxy wakes the VM (1-2s),
starts the `utah` service, and forwards the request. This is exactly the
"serve, do not connect(); HTTP is the wake" design. Billing is per awake time.
