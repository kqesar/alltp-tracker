import { PERFORMANCE_SPECS, webProject } from "./vitest.shared.ts";

// The web app's unit tests. jsdom is the heavy part of setting a spec up, so
// the specs share one per worker, each in a context of its own (`vmThreads`:
// isolation per file kept, about a third of the CPU saved). Code runs slower
// inside a vm context, which the timing specs cannot take: they run in the
// `forks` project of vitest.perf.config.ts.
export default webProject({
  exclude: [PERFORMANCE_SPECS],
  // The build's lazy guard too, a plugin of vite.config.ts
  include: ["src/**/*.spec.{ts,tsx}", "lazy-guard/*.spec.ts"],
  name: "web",
  pool: "vmThreads",
});
