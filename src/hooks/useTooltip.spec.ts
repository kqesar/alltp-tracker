import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTooltip } from "./useTooltip";

describe("useTooltip", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("initializes with tooltip hidden", () => {
    const { result } = renderHook(() => useTooltip());

    expect(result.current.isVisible).toBe(false);
  });

  it("shows tooltip after delay on showTooltip", () => {
    const { result } = renderHook(() => useTooltip({ delay: 500 }));

    act(() => {
      result.current.showTooltip();
    });

    expect(result.current.isVisible).toBe(false);

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current.isVisible).toBe(true);
  });

  it("hides tooltip immediately on hideTooltip", () => {
    const { result } = renderHook(() => useTooltip({ delay: 100 }));

    act(() => {
      result.current.showTooltip();
      vi.advanceTimersByTime(100);
    });

    expect(result.current.isVisible).toBe(true);

    act(() => {
      result.current.hideTooltip();
    });

    expect(result.current.isVisible).toBe(false);
  });

  it("cancels show timeout when hideTooltip is called before delay", () => {
    const { result } = renderHook(() => useTooltip({ delay: 500 }));

    act(() => {
      result.current.showTooltip();
    });

    expect(result.current.isVisible).toBe(false);

    act(() => {
      result.current.hideTooltip();
      vi.advanceTimersByTime(500);
    });

    expect(result.current.isVisible).toBe(false);
  });

  it("toggles tooltip visibility", () => {
    const { result } = renderHook(() => useTooltip({ delay: 100 }));

    act(() => {
      result.current.toggleTooltip();
      vi.advanceTimersByTime(100);
    });

    expect(result.current.isVisible).toBe(true);

    act(() => {
      result.current.toggleTooltip();
    });

    expect(result.current.isVisible).toBe(false);
  });

  it("does not show tooltip when disabled", () => {
    const { result } = renderHook(() =>
      useTooltip({ delay: 100, disabled: true }),
    );

    act(() => {
      result.current.showTooltip();
      vi.advanceTimersByTime(100);
    });

    expect(result.current.isVisible).toBe(false);
  });

  it("provides correct trigger props", () => {
    const { result } = renderHook(() => useTooltip());

    const { triggerProps } = result.current;

    expect(triggerProps).toHaveProperty("onMouseEnter");
    expect(triggerProps).toHaveProperty("onMouseLeave");
    expect(triggerProps).toHaveProperty("onFocus");
    expect(triggerProps).toHaveProperty("onBlur");
    expect(typeof triggerProps.onMouseEnter).toBe("function");
    expect(typeof triggerProps.onMouseLeave).toBe("function");
    expect(typeof triggerProps.onFocus).toBe("function");
    expect(typeof triggerProps.onBlur).toBe("function");
  });

  it("trigger props work correctly", () => {
    const { result } = renderHook(() => useTooltip({ delay: 100 }));

    const { triggerProps } = result.current;

    // Test mouse enter
    act(() => {
      triggerProps.onMouseEnter();
      vi.advanceTimersByTime(100);
    });

    expect(result.current.isVisible).toBe(true);

    // Test mouse leave
    act(() => {
      triggerProps.onMouseLeave();
    });

    expect(result.current.isVisible).toBe(false);

    // Test focus
    act(() => {
      triggerProps.onFocus();
      vi.advanceTimersByTime(100);
    });

    expect(result.current.isVisible).toBe(true);

    // Test blur
    act(() => {
      triggerProps.onBlur();
    });

    expect(result.current.isVisible).toBe(false);
  });

  it("cleans up timeout on unmount", () => {
    const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");
    const { result, unmount } = renderHook(() => useTooltip({ delay: 500 }));

    act(() => {
      result.current.showTooltip();
    });

    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it("uses default delay when not specified", () => {
    const { result } = renderHook(() => useTooltip());

    act(() => {
      result.current.showTooltip();
    });

    expect(result.current.isVisible).toBe(false);

    // Default delay should be 500ms
    act(() => {
      vi.advanceTimersByTime(499);
    });

    expect(result.current.isVisible).toBe(false);

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(result.current.isVisible).toBe(true);
  });

  it("handles rapid show/hide calls correctly", () => {
    const { result } = renderHook(() => useTooltip({ delay: 100 }));

    // Show, hide, show quickly
    act(() => {
      result.current.showTooltip();
    });

    act(() => {
      result.current.hideTooltip();
    });

    act(() => {
      result.current.showTooltip();
      vi.advanceTimersByTime(100);
    });

    expect(result.current.isVisible).toBe(true);
  });
});
