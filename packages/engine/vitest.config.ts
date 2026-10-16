import { defineProject } from "vitest/config";

// The engine is pure TypeScript: its tests run in Node, without the app's
// jsdom environment and setup file, which also proves it needs no DOM.
export default defineProject({
  test: {
    environment: "node",
    include: ["{src,examples,test}/**/*.spec.ts"],
    name: "engine",
  },
});
