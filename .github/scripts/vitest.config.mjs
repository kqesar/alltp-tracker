import { defineProject } from "vitest/config";

// The CI's own scripts (docs/ci.md): plain Node, no DOM. The bash scripts are
// exercised against forged API answers by hand (docs/ci.md); the ones that
// decide what the unit tests run are plain functions, held here.
export default defineProject({
  test: {
    environment: "node",
    include: ["*.spec.mjs"],
    name: "ci-scripts",
  },
});
