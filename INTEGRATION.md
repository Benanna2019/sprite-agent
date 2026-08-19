# Integrating Utah, and turning it into something anyone can spin up

Two questions this answers: how another agent or app talks to a Utah instance, and how someone gets their own Utah without you deploying it for them.

## Part 1: the integration contract

Utah's whole surface is events in, durable work, results out. You don't integrate with Utah's code, you integrate with its event bus (Inngest) and its URL.

Three ways in, same engine underneath:

1. **Send an event (native).** Anything that can POST to Inngest can drive Utah. Emit `agent.message.received`, or any event a Utah function triggers on. Inngest routes it to the Sprite, Utah runs durably. This is how another backend or agent hands work over.

2. **HTTP front door (for the not-Inngest-aware).** A thin route on the Sprite, e.g. `POST /message`, that just enqueues the event and returns a run id. Any agent that can call an HTTP endpoint uses Utah without knowing Inngest exists. Small addition, not built yet.

3. **MCP (for tool-using agents).** The `utah-mcp` pattern exposes Utah's tools over MCP, so Claude, Cursor, or any MCP client drives Utah as tools (`write_function`, `send_event`, ...). This is the "another agent uses Utah as a skill" path.

### Getting a result back

Two patterns, both durable:

- **Wait for it.** The caller sends the request event and does `step.waitForEvent("agent.result", ...)`. Utah emits `agent.result` when done. The caller can sleep the whole time. Agent-to-agent handoff done right.
- **Poll it.** Read the Inngest run by id via the Inngest API. Simpler, fine for a UI.

### Agent-to-agent, concretely

Agent B needs something done that should be durable, scheduled, or long-running. B emits an event to Utah, keeps the id, and either waits on `agent.result` or checks later. Utah owns the retries, the sleeps, the tool calls. B stays simple. Utah is the durable-work limb other agents borrow.

## Part 2: anyone spins up their own, you never deploy per person

You deployed one Sprite by hand. The product version is a provisioner: a user signs up and gets their own isolated Utah, created programmatically. This fits Sprites exactly, because Sprites exists to isolate one agent per box.

### The shape

- **Control plane (built once).** A small service that, on signup, calls the Sprites API to create a Sprite, pushes the harness onto it (the `deploy.sh` steps as API calls), sets that user's keys, and returns their URL. It is `deploy.sh` turned into a signup handler.
- **One Sprite per user.** Their functions, their disk, their keys, their URL, asleep when idle so it costs pennies. Utah writing its own functions means each user's box grows to fit them without you shipping anything.
- **Bring-your-own or proxied keys.** Either the user supplies their AI Gateway and Inngest keys, or you provision an Inngest environment and proxy the model behind your own gateway key and bill usage.

### What each side owns

- You own: the control plane, the harness template, the base setup. You never hand-deploy again.
- The user owns: their Sprite, their agent, their data. Isolated from everyone else's by construction.

### What's needed to build it (the gaps)

1. A provisioner service (Sprites API + Inngest API to mint a per-user environment).
2. A signup and onboarding flow, plus key handling.
3. A fast bootstrap: a base image or a Sprite checkpoint so new boxes come up in seconds with deps already installed, instead of `npm install` each time.
4. Billing, if you proxy the model and the compute.

### The one-liner

Utah is a durable agent that lives on a per-user Sprite, extends itself by writing its own functions, and is reachable by any other agent through an event or a URL. The business is the control plane that hands each person their own, and never a manual deploy.
