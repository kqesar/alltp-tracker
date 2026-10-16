import { afterEach, describe, expect, it, vi } from "vitest";
import { systemClock, systemVisibility, systemWebSocket } from "./platform";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("platform seams", () => {
  it("follows the page's visibility, and is always visible without a page", () => {
    expect(systemVisibility.hidden()).toBe(false);
    expect(systemVisibility.subscribe(() => {})).toBeTypeOf("function");

    const listeners = new Set<() => void>();
    const doc = {
      addEventListener: (_: string, listener: () => void) =>
        listeners.add(listener),
      removeEventListener: (_: string, listener: () => void) =>
        listeners.delete(listener),
      visibilityState: "hidden",
    };
    vi.stubGlobal("document", doc);
    expect(systemVisibility.hidden()).toBe(true);
    let calls = 0;
    const unsubscribe = systemVisibility.subscribe(() => calls++);
    for (const listener of listeners) listener();
    unsubscribe();
    expect(listeners.size).toBe(0);
    expect(calls).toBe(1);
  });

  it("looks timers up at call time, so fake timers apply", () => {
    vi.useFakeTimers({ now: 1234 });
    let fired = false;
    const handle = systemClock.setTimeout(() => {
      fired = true;
    }, 10);
    expect(systemClock.now()).toBe(1234);
    systemClock.clearTimeout(handle);
    vi.advanceTimersByTime(20);
    expect(fired).toBe(false);
  });

  it("uses the host's WebSocket, and says when there is none", () => {
    const created: string[] = [];
    vi.stubGlobal(
      "WebSocket",
      class {
        constructor(url: string) {
          created.push(url);
        }
      },
    );
    systemWebSocket("ws://localhost:23074");
    expect(created).toEqual(["ws://localhost:23074"]);
    vi.stubGlobal("WebSocket", undefined);
    expect(() => systemWebSocket("ws://localhost:23074")).toThrow(
      /no WebSocket/,
    );
  });
});
