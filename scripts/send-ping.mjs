import { inngest } from "../src/inngest.js";

// Fires the agent/ping event. With INNGEST_DEV=1 this goes to the local Dev
// Server, which routes it to the serve endpoint and runs the function durably.
const name = process.argv[2] || "Shaun";
const res = await inngest.send({ name: "agent/ping", data: { name } });
console.log("sent agent/ping for", name, "->", JSON.stringify(res));
process.exit(0);
