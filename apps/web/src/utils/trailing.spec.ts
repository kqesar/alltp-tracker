import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { trailing } from "@/utils/trailing";

describe("trailing", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("runs once, at the end of the wait, for a burst of pokes", () => {
    const run = vi.fn();
    const wait = trailing(250, run);
    wait.poke();
    vi.advanceTimersByTime(100);
    wait.poke();
    wait.poke();
    vi.advanceTimersByTime(149);
    expect(run).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("starts a new wait with the next poke", () => {
    const run = vi.fn();
    const wait = trailing(250, run);
    wait.poke();
    vi.advanceTimersByTime(250);
    wait.poke();
    vi.advanceTimersByTime(250);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("drops a wait that is cancelled", () => {
    const run = vi.fn();
    const wait = trailing(250, run);
    wait.poke();
    wait.cancel();
    vi.advanceTimersByTime(1000);
    expect(run).not.toHaveBeenCalled();
    wait.poke();
    vi.advanceTimersByTime(250);
    expect(run).toHaveBeenCalledTimes(1);
  });
});
