// The one place model choice happens.
//
// Today: a single sensible default, overridable with UTAH_MODEL.
// Tomorrow: this is where "best model for the job" lives. pickModel(task) can
// look at the request and route (cheap model for simple asks, strong model for
// hard reasoning, a vision model when there's an image, and so on). Because
// every caller goes through here, adding that router later touches only this file.
//
// Model ids are Vercel AI Gateway slugs in "creator/model" form, e.g.
// "openai/gpt-4o-mini", "anthropic/claude-sonnet-4.5". The AI SDK resolves them
// through the Gateway when AI_GATEWAY_API_KEY is set, so one key reaches every
// provider and swapping models is a string change.
export function pickModel(_task) {
  if (process.env.UTAH_MODEL) return process.env.UTAH_MODEL;
  return "openai/gpt-4o-mini";
}
