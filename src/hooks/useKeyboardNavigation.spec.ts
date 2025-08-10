import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useKeyboardNavigation } from "@/hooks/useKeyboardNavigation";

// Mock DOM methods
Object.defineProperty(HTMLElement.prototype, "focus", {
  configurable: true,
  value: vi.fn(),
});

describe("useKeyboardNavigation", () => {
  const mockItemLayout = [
    ["sword", "shield", "bow"],
    ["bottle", "", "hammer"],
    ["hookshot", "boots", "glove"],
  ];

  const defaultProps = {
    enabled: true,
    itemLayout: mockItemLayout,
    totalRows: 3,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Initialization", () => {
    it("should return necessary functions and refs", () => {
      const { result } = renderHook(() => useKeyboardNavigation(defaultProps));

      expect(result.current.containerRef).toBeDefined();
      expect(result.current.focusFirstItem).toBeInstanceOf(Function);
      expect(result.current.focusPosition).toBeInstanceOf(Function);
      expect(result.current.updateFocusPosition).toBeInstanceOf(Function);
      expect(result.current.currentFocus).toEqual({ col: 0, row: 0 });
    });

    it("should initialize with correct current focus position", () => {
      const { result } = renderHook(() => useKeyboardNavigation(defaultProps));

      expect(result.current.currentFocus).toEqual({ col: 0, row: 0 });
    });
  });

  describe("Focus position updates", () => {
    it("should update current focus position when updateFocusPosition is called", () => {
      const { result } = renderHook(() => useKeyboardNavigation(defaultProps));

      act(() => {
        result.current.updateFocusPosition(1, 2);
      });

      expect(result.current.currentFocus).toEqual({ col: 2, row: 1 });
    });

    it("should update focus position to different coordinates", () => {
      const { result } = renderHook(() => useKeyboardNavigation(defaultProps));

      act(() => {
        result.current.updateFocusPosition(2, 1);
      });

      expect(result.current.currentFocus).toEqual({ col: 1, row: 2 });
    });
  });

  describe("When disabled", () => {
    it("should still provide functions when disabled", () => {
      const { result } = renderHook(() =>
        useKeyboardNavigation({ ...defaultProps, enabled: false }),
      );

      expect(result.current.containerRef).toBeDefined();
      expect(result.current.focusFirstItem).toBeInstanceOf(Function);
      expect(result.current.focusPosition).toBeInstanceOf(Function);
      expect(result.current.updateFocusPosition).toBeInstanceOf(Function);
    });

    it("should not affect focus position tracking when disabled", () => {
      const { result } = renderHook(() =>
        useKeyboardNavigation({ ...defaultProps, enabled: false }),
      );

      act(() => {
        result.current.updateFocusPosition(1, 1);
      });

      expect(result.current.currentFocus).toEqual({ col: 1, row: 1 });
    });
  });

  describe("Edge cases", () => {
    it("should handle empty item layout", () => {
      const { result } = renderHook(() =>
        useKeyboardNavigation({
          enabled: true,
          itemLayout: [],
          totalRows: 0,
        }),
      );

      expect(result.current.currentFocus).toEqual({ col: 0, row: 0 });
    });

    it("should handle single item layout", () => {
      const { result } = renderHook(() =>
        useKeyboardNavigation({
          enabled: true,
          itemLayout: [["sword"]],
          totalRows: 1,
        }),
      );

      expect(result.current.currentFocus).toEqual({ col: 0, row: 0 });
    });

    it("should handle layout with empty cells", () => {
      const layoutWithEmpties = [
        ["", "sword", ""],
        ["", "", "shield"],
      ];

      const { result } = renderHook(() =>
        useKeyboardNavigation({
          enabled: true,
          itemLayout: layoutWithEmpties,
          totalRows: 2,
        }),
      );

      expect(result.current.currentFocus).toEqual({ col: 0, row: 0 });
    });
  });

  describe("Function stability", () => {
    it("should maintain function references across re-renders", () => {
      const { result, rerender } = renderHook(() =>
        useKeyboardNavigation(defaultProps),
      );

      const firstRenderFunctions = {
        focusFirstItem: result.current.focusFirstItem,
        focusPosition: result.current.focusPosition,
        updateFocusPosition: result.current.updateFocusPosition,
      };

      rerender();

      expect(result.current.focusFirstItem).toBe(
        firstRenderFunctions.focusFirstItem,
      );
      expect(result.current.focusPosition).toBe(
        firstRenderFunctions.focusPosition,
      );
      expect(result.current.updateFocusPosition).toBe(
        firstRenderFunctions.updateFocusPosition,
      );
    });
  });

  describe("Layout changes", () => {
    it("should handle layout prop changes", () => {
      const { result, rerender } = renderHook(
        (props) => useKeyboardNavigation(props),
        { initialProps: defaultProps },
      );

      const newLayout = [["newitem1", "newitem2"]];
      const newProps = {
        enabled: true,
        itemLayout: newLayout,
        totalRows: 1,
      };

      rerender(newProps);

      expect(result.current.currentFocus).toEqual({ col: 0, row: 0 });
    });
  });
});
