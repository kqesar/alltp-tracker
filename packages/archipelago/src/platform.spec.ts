import { afterEach, describe, expect, it, vi } from "vitest";
import {
  systemClock,
  systemOnline,
  systemUuid,
  systemVisibility,
  systemWebSocket,
  withWebSocket,
} from "./platform";

const host = globalThis as Record<string, unknown>;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("platform seams", () => {
  it("swaps the global WebSocket for one synchronous call only", () => {
    const native = host.WebSocket;
    const made: string[] = [];
    const socket = withWebSocket(
      (url) => {
        made.push(url);
        return { url } as never;
      },
      () =>
        new (host.WebSocket as new (u: unknown) => { url: string })(
          new URL("ws://h:1"),
        ),
    );
    expect(socket).toEqual({ url: "ws://h:1/" });
    expect(made).toEqual(["ws://h:1/"]);
    expect(host.WebSocket).toBe(native);
  });

  it("builds the host's own socket while the global is swapped", () => {
    class Native {
      constructor(readonly url: string) {}
    }
    vi.stubGlobal("WebSocket", Native);
    const socket = withWebSocket(
      systemWebSocket,
      () => new (host.WebSocket as new (u: string) => unknown)("ws://h:2"),
    );
    expect(socket).toBeInstanceOf(Native);
    expect(host.WebSocket).toBe(Native);
  });

  it("puts the global back when the call throws", () => {
    const native = host.WebSocket;
    expect(() =>
      withWebSocket(systemWebSocket, () => {
        throw new Error("boom");
      }),
    ).toThrow("boom");
    expect(host.WebSocket).toBe(native);
  });

  it("throws where there is no WebSocket or crypto", () => {
    vi.stubGlobal("WebSocket", undefined);
    expect(() => systemWebSocket("ws://h:1")).toThrow("no WebSocket");
    vi.stubGlobal("crypto", {});
    expect(() => systemUuid()).toThrow("no crypto.randomUUID");
  });

  it("makes v4 UUIDs", () => {
    expect(systemUuid()).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("reads time and timers from the host", async () => {
    expect(Math.abs(systemClock.now() - Date.now())).toBeLessThan(50);
    const fired = await new Promise<boolean>((resolve) => {
      const handle = systemClock.setTimeout(() => resolve(false), 5);
      systemClock.clearTimeout(handle);
      systemClock.setTimeout(() => resolve(true), 10);
    });
    expect(fired).toBe(true);
  });

  it("is visible and online outside a page", () => {
    expect(systemVisibility.hidden()).toBe(false);
    expect(systemOnline.online()).toBe(true);
    systemVisibility.subscribe(() => {})();
  });

  it("follows the document and the window when there is one", () => {
    const doc = new EventTarget() as EventTarget & { visibilityState: string };
    doc.visibilityState = "hidden";
    vi.stubGlobal("document", doc);
    const win = new EventTarget();
    vi.stubGlobal("addEventListener", win.addEventListener.bind(win));
    vi.stubGlobal("removeEventListener", win.removeEventListener.bind(win));
    vi.stubGlobal("navigator", { onLine: false });
    expect(systemVisibility.hidden()).toBe(true);
    expect(systemOnline.online()).toBe(false);
    const heard: string[] = [];
    const offVisibility = systemVisibility.subscribe(() =>
      heard.push("visibility"),
    );
    const offOnline = systemOnline.subscribe(() => heard.push("network"));
    doc.dispatchEvent(new Event("visibilitychange"));
    win.dispatchEvent(new Event("online"));
    win.dispatchEvent(new Event("offline"));
    offVisibility();
    offOnline();
    doc.dispatchEvent(new Event("visibilitychange"));
    win.dispatchEvent(new Event("online"));
    expect(heard).toEqual(["visibility", "network", "network"]);
  });

  it("does without window events", () => {
    vi.stubGlobal("addEventListener", undefined);
    systemOnline.subscribe(() => {})();
  });
});
