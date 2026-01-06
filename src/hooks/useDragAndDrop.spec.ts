import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useDragAndDrop } from "./useDragAndDrop";

describe("useDragAndDrop", () => {
  const mockLayout = [
    ["item1", "item2", "item3"],
    ["item4", "item5", "item6"],
  ];

  const createMockDragEvent = () =>
    ({
      dataTransfer: {
        dropEffect: "",
      },
      preventDefault: vi.fn(),
    }) as unknown as React.DragEvent;

  it("should initialize with correct default values", () => {
    const onLayoutChange = vi.fn();
    const { result } = renderHook(() =>
      useDragAndDrop({
        itemLayout: mockLayout,
        onLayoutChange,
      }),
    );

    expect(result.current.dragState.isDragging).toBe(false);
    expect(result.current.dragState.draggedItem).toBe(null);
    expect(result.current.dragState.draggedFrom).toBe(null);
    expect(result.current.dragState.dropTarget).toBe(null);
  });

  it("should start dragging when handleDragStart is called", () => {
    const onLayoutChange = vi.fn();
    const { result } = renderHook(() =>
      useDragAndDrop({
        itemLayout: mockLayout,
        onLayoutChange,
      }),
    );

    act(() => {
      result.current.handleDragStart("item1", 0, 0);
    });

    expect(result.current.dragState.isDragging).toBe(true);
    expect(result.current.dragState.draggedItem).toBe("item1");
    expect(result.current.dragState.draggedFrom).toEqual({ col: 0, row: 0 });
  });

  it("should not start dragging for blank items", () => {
    const onLayoutChange = vi.fn();
    const { result } = renderHook(() =>
      useDragAndDrop({
        itemLayout: mockLayout,
        onLayoutChange,
      }),
    );

    act(() => {
      result.current.handleDragStart("blank", 0, 0);
    });

    expect(result.current.dragState.isDragging).toBe(false);
  });

  it("should not start dragging for empty items", () => {
    const onLayoutChange = vi.fn();
    const { result } = renderHook(() =>
      useDragAndDrop({
        itemLayout: mockLayout,
        onLayoutChange,
      }),
    );

    act(() => {
      result.current.handleDragStart("", 0, 0);
    });

    expect(result.current.dragState.isDragging).toBe(false);
  });

  it("should update drop target on drag over", () => {
    const onLayoutChange = vi.fn();
    const { result } = renderHook(() =>
      useDragAndDrop({
        itemLayout: mockLayout,
        onLayoutChange,
      }),
    );

    // Start dragging first
    act(() => {
      result.current.handleDragStart("item1", 0, 0);
    });

    const mockEvent = createMockDragEvent();
    act(() => {
      result.current.handleDragOver(mockEvent, 1, 1);
    });

    expect(result.current.dragState.dropTarget).toEqual({ col: 1, row: 1 });
    expect(mockEvent.preventDefault).toHaveBeenCalled();
  });

  it("should clear drop target on drag leave", () => {
    const onLayoutChange = vi.fn();
    const { result } = renderHook(() =>
      useDragAndDrop({
        itemLayout: mockLayout,
        onLayoutChange,
      }),
    );

    // Start dragging and set drop target
    act(() => {
      result.current.handleDragStart("item1", 0, 0);
    });

    const mockEvent = createMockDragEvent();
    act(() => {
      result.current.handleDragOver(mockEvent, 1, 1);
    });

    act(() => {
      result.current.handleDragLeave();
    });

    expect(result.current.dragState.dropTarget).toBe(null);
  });

  it("should swap items on drop and call onLayoutChange", () => {
    const onLayoutChange = vi.fn();
    const { result } = renderHook(() =>
      useDragAndDrop({
        itemLayout: mockLayout,
        onLayoutChange,
      }),
    );

    // Start dragging item1 from (0, 0)
    act(() => {
      result.current.handleDragStart("item1", 0, 0);
    });

    // Drop at (1, 1)
    act(() => {
      result.current.handleDrop(1, 1);
    });

    expect(onLayoutChange).toHaveBeenCalledTimes(1);
    const newLayout = onLayoutChange.mock.calls[0][0];

    // Check items are swapped
    expect(newLayout[0][0]).toBe("item5");
    expect(newLayout[1][1]).toBe("item1");

    // Drag state should be reset
    expect(result.current.dragState.isDragging).toBe(false);
  });

  it("should not swap if dropping in the same position", () => {
    const onLayoutChange = vi.fn();
    const { result } = renderHook(() =>
      useDragAndDrop({
        itemLayout: mockLayout,
        onLayoutChange,
      }),
    );

    act(() => {
      result.current.handleDragStart("item1", 0, 0);
    });

    act(() => {
      result.current.handleDrop(0, 0);
    });

    expect(onLayoutChange).not.toHaveBeenCalled();
    expect(result.current.dragState.isDragging).toBe(false);
  });

  it("should reset drag state on drag end", () => {
    const onLayoutChange = vi.fn();
    const { result } = renderHook(() =>
      useDragAndDrop({
        itemLayout: mockLayout,
        onLayoutChange,
      }),
    );

    act(() => {
      result.current.handleDragStart("item1", 0, 0);
    });

    act(() => {
      result.current.handleDragEnd();
    });

    expect(result.current.dragState.isDragging).toBe(false);
    expect(result.current.dragState.draggedItem).toBe(null);
  });

  it("should correctly identify drop target", () => {
    const onLayoutChange = vi.fn();
    const { result } = renderHook(() =>
      useDragAndDrop({
        itemLayout: mockLayout,
        onLayoutChange,
      }),
    );

    act(() => {
      result.current.handleDragStart("item1", 0, 0);
    });

    const mockEvent = createMockDragEvent();
    act(() => {
      result.current.handleDragOver(mockEvent, 1, 2);
    });

    expect(result.current.isDropTarget(1, 2)).toBe(true);
    expect(result.current.isDropTarget(0, 0)).toBe(false);
  });

  it("should correctly identify dragged item", () => {
    const onLayoutChange = vi.fn();
    const { result } = renderHook(() =>
      useDragAndDrop({
        itemLayout: mockLayout,
        onLayoutChange,
      }),
    );

    act(() => {
      result.current.handleDragStart("item1", 0, 0);
    });

    expect(result.current.isDraggedItem(0, 0)).toBe(true);
    expect(result.current.isDraggedItem(1, 1)).toBe(false);
  });

  it("should not work when disabled", () => {
    const onLayoutChange = vi.fn();
    const { result } = renderHook(() =>
      useDragAndDrop({
        enabled: false,
        itemLayout: mockLayout,
        onLayoutChange,
      }),
    );

    act(() => {
      result.current.handleDragStart("item1", 0, 0);
    });

    expect(result.current.dragState.isDragging).toBe(false);
  });

  it("should not process drag over when not dragging", () => {
    const onLayoutChange = vi.fn();
    const { result } = renderHook(() =>
      useDragAndDrop({
        itemLayout: mockLayout,
        onLayoutChange,
      }),
    );

    const mockEvent = createMockDragEvent();
    act(() => {
      result.current.handleDragOver(mockEvent, 1, 1);
    });

    expect(mockEvent.preventDefault).not.toHaveBeenCalled();
    expect(result.current.dragState.dropTarget).toBe(null);
  });
});
