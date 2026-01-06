import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTouchGestures } from "./useTouchGestures";

// Mock timers
vi.useFakeTimers();

// Mock DOM element for testing
const createMockElement = () =>
  ({
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }) as unknown as HTMLElement;

describe("useTouchGestures", () => {
  let mockElement: HTMLElement;
  let onTap: (event: TouchEvent | MouseEvent) => void;
  let onLongPress: (event: TouchEvent | MouseEvent) => void;
  let onSwipe: (direction: "left" | "right" | "up" | "down") => void;

  beforeEach(() => {
    mockElement = createMockElement();
    onTap = vi.fn();
    onLongPress = vi.fn();
    onSwipe = vi.fn();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.clearAllMocks();
  });

  it("should initialize with correct default values", () => {
    const { result } = renderHook(() =>
      useTouchGestures({
        onLongPress,
        onSwipe,
        onTap,
      }),
    );

    expect(result.current.ref).toBeDefined();
    expect(result.current.gestures).toBeDefined();
  });

  it("should call onTap for quick touch", () => {
    const { result } = renderHook(() =>
      useTouchGestures({
        longPressDelay: 500,
        onTap,
      }),
    );

    // Assign mock element to ref
    act(() => {
      if (result.current.ref) {
        result.current.ref.current = mockElement;
      }
    });

    // Simulate quick touch
    const touchStart = new TouchEvent("touchstart", {
      touches: [{ clientX: 100, clientY: 100 } as Touch],
    });

    const touchEnd = new TouchEvent("touchend", {
      changedTouches: [{ clientX: 100, clientY: 100 } as Touch],
    });

    act(() => {
      result.current.gestures.onTouchStart(touchStart);
    });

    act(() => {
      vi.advanceTimersByTime(100); // Less than longPressDelay
      result.current.gestures.onTouchEnd(touchEnd);
    });

    expect(onTap).toHaveBeenCalledWith(touchEnd);
  });

  it("should call onLongPress for long touch", () => {
    const { result } = renderHook(() =>
      useTouchGestures({
        longPressDelay: 500,
        onLongPress,
      }),
    );

    act(() => {
      if (result.current.ref) {
        result.current.ref.current = mockElement;
      }
    });

    const touchStart = new TouchEvent("touchstart", {
      touches: [{ clientX: 100, clientY: 100 } as Touch],
    });

    act(() => {
      result.current.gestures.onTouchStart(touchStart);
    });

    act(() => {
      vi.advanceTimersByTime(600); // More than longPressDelay
    });

    expect(onLongPress).toHaveBeenCalledWith(touchStart);
  });

  it("should call onSwipe for swipe gestures", () => {
    const { result } = renderHook(() =>
      useTouchGestures({
        onSwipe,
        swipeThreshold: 50,
      }),
    );

    act(() => {
      if (result.current.ref) {
        result.current.ref.current = mockElement;
      }
    });

    // Simulate horizontal swipe right
    const touchStart = new TouchEvent("touchstart", {
      touches: [{ clientX: 100, clientY: 100 } as Touch],
    });

    const touchEnd = new TouchEvent("touchend", {
      changedTouches: [{ clientX: 200, clientY: 100 } as Touch], // Moved 100px right
    });

    act(() => {
      result.current.gestures.onTouchStart(touchStart);
    });

    act(() => {
      vi.advanceTimersByTime(100);
      result.current.gestures.onTouchEnd(touchEnd);
    });

    expect(onSwipe).toHaveBeenCalledWith("right");
  });

  it("should handle vertical swipe gestures", () => {
    const { result } = renderHook(() =>
      useTouchGestures({
        onSwipe,
        swipeThreshold: 50,
      }),
    );

    act(() => {
      if (result.current.ref) {
        result.current.ref.current = mockElement;
      }
    });

    // Simulate vertical swipe down
    const touchStart = new TouchEvent("touchstart", {
      touches: [{ clientX: 100, clientY: 100 } as Touch],
    });

    const touchEnd = new TouchEvent("touchend", {
      changedTouches: [{ clientX: 100, clientY: 200 } as Touch], // Moved 100px down
    });

    act(() => {
      result.current.gestures.onTouchStart(touchStart);
    });

    act(() => {
      vi.advanceTimersByTime(100);
      result.current.gestures.onTouchEnd(touchEnd);
    });

    expect(onSwipe).toHaveBeenCalledWith("down");
  });

  it("should not trigger callbacks when disabled", () => {
    const { result } = renderHook(() =>
      useTouchGestures({
        disabled: true,
        onLongPress,
        onSwipe,
        onTap,
      }),
    );

    act(() => {
      if (result.current.ref) {
        result.current.ref.current = mockElement;
      }
    });

    const touchStart = new TouchEvent("touchstart", {
      touches: [{ clientX: 100, clientY: 100 } as Touch],
    });

    const touchEnd = new TouchEvent("touchend", {
      changedTouches: [{ clientX: 100, clientY: 100 } as Touch],
    });

    act(() => {
      result.current.gestures.onTouchStart(touchStart);
      result.current.gestures.onTouchEnd(touchEnd);
    });

    expect(onTap).not.toHaveBeenCalled();
    expect(onLongPress).not.toHaveBeenCalled();
    expect(onSwipe).not.toHaveBeenCalled();
  });

  it("should cancel long press on movement", () => {
    const { result } = renderHook(() =>
      useTouchGestures({
        longPressDelay: 500,
        onLongPress,
      }),
    );

    act(() => {
      if (result.current.ref) {
        result.current.ref.current = mockElement;
      }
    });

    const touchStart = new TouchEvent("touchstart", {
      touches: [{ clientX: 100, clientY: 100 } as Touch],
    });

    const touchMove = new TouchEvent("touchmove", {
      touches: [{ clientX: 120, clientY: 120 } as Touch], // Moved > 10px
    });

    act(() => {
      result.current.gestures.onTouchStart(touchStart);
    });

    act(() => {
      vi.advanceTimersByTime(200);
      result.current.gestures.onTouchMove(touchMove);
    });

    act(() => {
      vi.advanceTimersByTime(400); // Total 600ms, should have triggered if not cancelled
    });

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("should handle mouse events as fallback", () => {
    const { result } = renderHook(() =>
      useTouchGestures({
        onTap,
      }),
    );

    act(() => {
      if (result.current.ref) {
        result.current.ref.current = mockElement;
      }
    });

    const mouseDown = new MouseEvent("mousedown", {
      clientX: 100,
      clientY: 100,
    });

    const mouseUp = new MouseEvent("mouseup", {
      clientX: 100,
      clientY: 100,
    });

    act(() => {
      result.current.gestures.onMouseDown(mouseDown);
    });

    act(() => {
      vi.advanceTimersByTime(100);
      result.current.gestures.onMouseUp(mouseUp);
    });

    expect(onTap).toHaveBeenCalledWith(mouseUp);
  });
});
