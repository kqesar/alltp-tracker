import { defineProject } from "vitest/config";

// Pure TypeScript run in Node: the transport talks to an in-process fake
// usb2snes server through Node's built-in WebSocket client, the one browsers
// expose as well.
export default defineProject({
  test: {
    environment: "node",
    include: ["{src,test}/**/*.spec.ts"],
    name: "autotrack",
    // A hung test, not a slow one: specs take ~200 ms, but parallel worktree
    // runs under coverage slow them 25x past the 5 s default. Timing budgets
    // are asserted by their own tests.
    testTimeout: 20_000,
  },
});
