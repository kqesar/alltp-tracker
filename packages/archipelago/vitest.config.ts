import { defineProject } from "vitest/config";

// Pure TypeScript run in Node: the session runs the real archipelago.js on
// in-memory sockets (test/fake-socket.ts) and, in test/*.spec.ts, on Node's
// WebSocket against an in-process fake AP server.
export default defineProject({
  test: {
    environment: "node",
    include: ["{src,test}/**/*.spec.ts"],
    name: "archipelago",
    // A hung test, not a slow one: parallel worktree runs under coverage
    // slow the socket specs well past the 5 s default.
    testTimeout: 20_000,
  },
});
