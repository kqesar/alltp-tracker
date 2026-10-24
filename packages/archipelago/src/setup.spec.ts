import { describe, expect, it } from "vitest";
import { SESSION_CODES, type SessionStatus } from "./diagnostics";
import { SETUP_STEPS, setupProgress, statusKeys } from "./setup";

const refused = (reason: string): SessionStatus => ({
  code: "refused",
  reasons: [reason],
  serverVersion: "0.6.8",
  url: "ws://localhost:1",
});

describe("setup guide", () => {
  it("reacts only to codes the session has", () => {
    for (const step of SETUP_STEPS) {
      for (const key of [...step.done, ...step.failing]) {
        expect(SESSION_CODES).toContain(key.split(":")[0]);
      }
    }
  });

  it("gives every step a variant on every page and host", () => {
    for (const page of ["site", "desktop"] as const) {
      for (const host of ["archipelago.gg", "self-hosted"] as const) {
        const progress = setupProgress({ code: "idle" }, { host, page });
        for (const step of progress.steps) {
          expect(
            step.variants.length,
            `${step.step.id} ${page} ${host}`,
          ).toBeGreaterThan(0);
        }
      }
    }
  });

  it("opens the first step before anything happened", () => {
    expect(
      setupProgress({ code: "idle" }, { host: "archipelago.gg", page: "site" })
        .focus,
    ).toBe("address");
  });

  it.each([
    [
      { addressClass: "public", code: "blocked-insecure" } as SessionStatus,
      "reach",
    ],
    [refused("InvalidSlot"), "slot"],
    [refused("InvalidPassword"), "password"],
    [refused("IncompatibleVersion"), "reach"],
  ])("opens the failing step for %j", (status, step) => {
    const progress = setupProgress(status, {
      host: "self-hosted",
      page: "site",
    });
    expect(progress.focus).toBe(step);
    expect(progress.steps.find((s) => s.step.id === step)?.state).toBe(
      "failing",
    );
  });

  it("ticks every step once connected", () => {
    const progress = setupProgress(
      { code: "connected", url: "wss://archipelago.gg:1" },
      { host: "archipelago.gg", page: "desktop" },
    );
    expect(progress.steps.map((s) => s.state)).toEqual([
      "done",
      "done",
      "done",
      "done",
    ]);
    expect(progress.focus).toBeNull();
  });

  it("asks for the browser's permission only on the site, for a local server", () => {
    const ids = (context: Parameters<typeof setupProgress>[1]) =>
      setupProgress({ code: "idle" }, context).steps.map((s) => s.step.id);
    const local = {
      browser: "chromium",
      host: "self-hosted",
      page: "site",
      where: "loopback",
    } as const;
    expect(ids(local)).toEqual([
      "address",
      "permission",
      "reach",
      "slot",
      "password",
    ]);
    expect(ids({ ...local, page: "desktop" })).not.toContain("permission");
    expect(ids({ ...local, where: "public" })).not.toContain("permission");
    expect(ids({ ...local, host: "archipelago.gg" })).not.toContain(
      "permission",
    );
    // Not known yet: no browser, or no address typed
    expect(ids({ ...local, browser: null })).not.toContain("permission");
    expect(ids({ ...local, where: null })).not.toContain("permission");
  });

  it.each([
    ["chromium", "loopback", /Access other apps and services on this device/],
    ["chromium", "private", /reach devices on your local network/],
    ["firefox", "loopback", /without asking/],
    ["firefox", "private", /Use Chrome or Edge, which ask first/],
    ["safari", "loopback", /Use the desktop app/],
    ["safari", "private", /Use the desktop app/],
  ] as const)("tells %s for a %s server what to do", (browser, where, text) => {
    const progress = setupProgress(
      {
        code: "local-network-denied",
        permission: "loopback-network",
        retryInMs: null,
        state: "prompt",
        url: "ws://127.0.0.1:1",
      },
      { browser, host: "self-hosted", page: "site", where },
    );
    expect(progress.focus).toBe("permission");
    const step = progress.steps.find((s) => s.step.id === "permission");
    expect(step?.variants).toHaveLength(1);
    expect(step?.variants[0].items.join(" ")).toMatch(text);
  });

  it("opens the permission step while the browser asks", () => {
    const context = {
      browser: "chromium",
      host: "self-hosted",
      page: "site",
      where: "private",
    } as const;
    const asking = setupProgress(
      {
        code: "local-network-prompt",
        permission: "local-network",
        url: "ws://10.0.0.2:1",
      },
      context,
    );
    expect(asking.focus).toBe("permission");
    // The server answered: the browser let it through
    const past = setupProgress(
      { attempt: 1, code: "authenticating", url: "ws://10.0.0.2:1" },
      context,
    );
    expect(past.steps.find((s) => s.step.id === "permission")?.state).toBe(
      "done",
    );
  });

  it("keys a refusal by its reasons", () => {
    expect(statusKeys(refused("InvalidSlot"))).toEqual([
      "refused:InvalidSlot",
      "refused",
    ]);
    expect(statusKeys({ code: "idle" })).toEqual(["idle"]);
  });

  it("says the room sees the tracker join", () => {
    const slot = SETUP_STEPS.find((s) => s.id === "slot");
    expect(slot?.variants[0].items.join(" ")).toMatch(/sees it join and leave/);
  });
});
