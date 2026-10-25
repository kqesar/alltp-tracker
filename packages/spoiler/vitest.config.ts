import { defineProject } from "vitest/config";

// Pure TypeScript over strings and numbers, run in Node.
export default defineProject({
  test: {
    environment: "node",
    include: ["{src,test}/**/*.spec.ts"],
    name: "spoiler",
    // A hung test, not a slow one: parallel worktree runs under coverage slow
    // the specs far past the 5 s default.
    testTimeout: 20_000,
  },
});
