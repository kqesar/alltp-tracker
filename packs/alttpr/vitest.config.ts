import { defineProject } from "vitest/config";

// A pack is data and pure functions over the engine: its tests run in Node,
// like the engine's, without the app's jsdom environment and setup file.
export default defineProject({
  test: {
    environment: "node",
    include: ["{src,test}/**/*.spec.ts"],
    name: "alttpr",
  },
});
