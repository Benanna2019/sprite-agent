import { Inngest } from "inngest";

// One client for the whole harness. In dev (INNGEST_DEV=1) the SDK talks to the
// local Inngest Dev Server, so no keys are needed. In prod it uses
// INNGEST_EVENT_KEY / INNGEST_SIGNING_KEY against Inngest Cloud.
export const inngest = new Inngest({ id: "shaun-scribe-agent" });
