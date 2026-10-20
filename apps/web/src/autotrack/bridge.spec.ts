import { afterEach, describe, expect, it } from "vitest";
import { bridgeOptions } from "@/autotrack/bridge";

afterEach(() => {
  window.history.replaceState(null, "", "/");
});

describe("bridgeOptions on the site", () => {
  it("leaves the session at SNI's address", async () => {
    expect(await bridgeOptions()).toEqual({});
  });

  it("points it at a bridge on another port", async () => {
    window.history.replaceState(null, "", "/?bridge=4321");
    expect(await bridgeOptions()).toEqual({ url: "ws://localhost:4321" });
  });
});
