import { defineProject } from "vitest/config";

// Pure TypeScript run in Node: the transport talks to an in-process fake
// usb2snes server through Node's built-in WebSocket client, the one browsers
// expose as well.
export default defineProject({
  test: {
    environment: "node",
    include: ["{src,test}/**/*.spec.ts"],
    name: "autotrack",
  },
});
