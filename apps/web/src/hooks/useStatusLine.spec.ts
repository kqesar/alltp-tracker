import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useStatusLine } from "@/hooks/useStatusLine";

describe("useStatusLine", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("shows a message, then clears it after four seconds", () => {
    const { result } = renderHook(() => useStatusLine());
    expect(result.current[0]).toBe("");

    act(() => result.current[1]("Save imported."));
    expect(result.current[0]).toBe("Save imported.");

    act(() => vi.advanceTimersByTime(3999));
    expect(result.current[0]).toBe("Save imported.");
    act(() => vi.advanceTimersByTime(1));
    expect(result.current[0]).toBe("");
  });

  it("restarts the delay for a new message", () => {
    const { result } = renderHook(() => useStatusLine());
    act(() => result.current[1]("New game started."));
    act(() => vi.advanceTimersByTime(3000));

    act(() => result.current[1]("Save imported."));
    act(() => vi.advanceTimersByTime(3000));

    expect(result.current[0]).toBe("Save imported.");
  });
});
