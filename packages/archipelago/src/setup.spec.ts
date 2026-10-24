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
