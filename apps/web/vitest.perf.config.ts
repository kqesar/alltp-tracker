import { PERFORMANCE_SPECS, webProject } from "./vitest.shared.ts";

// The web app's timing specs: each asserts a budget on the CPU time of the
// solver's hot paths, which only means something in a plain process (`forks`).
// Inside the `web` project's vm contexts the same code runs several times
// slower and the budgets would measure the context, not the code.
export default webProject({
  exclude: [],
  include: [PERFORMANCE_SPECS],
  name: "web-perf",
  pool: "forks",
});
