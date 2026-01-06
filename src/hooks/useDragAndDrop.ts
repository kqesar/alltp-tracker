import { useCallback, useRef, useState } from "react";

export type DragPosition = {
  row: number;
  col: number;
};

export type DragState = {
  isDragging: boolean;
  draggedItem: string | null;
  draggedFrom: DragPosition | null;
  dropTarget: DragPosition | null;
};

export type UseDragAndDropOptions = {
  /** The grid layout to modify */
  itemLayout: string[][];
  /** Callback when layout changes after a successful drop */
  onLayoutChange: (newLayout: string[][]) => void;
  /** Whether drag and drop is enabled */
  enabled?: boolean;
};

export type UseDragAndDropResult = {
  /** Current drag state */
  dragState: DragState;
  /** Handler for drag start event */
  handleDragStart: (item: string, row: number, col: number) => void;
  /** Handler for drag over event */
  handleDragOver: (e: React.DragEvent, row: number, col: number) => void;
  /** Handler for drag leave event */
  handleDragLeave: () => void;
  /** Handler for drop event */
  handleDrop: (row: number, col: number) => void;
  /** Handler for drag end event */
  handleDragEnd: () => void;
  /** Check if a position is the current drop target */
  isDropTarget: (row: number, col: number) => boolean;
  /** Check if a position is being dragged */
  isDraggedItem: (row: number, col: number) => boolean;
};

const initialDragState: DragState = {
  draggedFrom: null,
  draggedItem: null,
  dropTarget: null,
  isDragging: false,
};

/**
 * Hook for managing drag and drop functionality in the tracker grid
 * Allows users to reorder items by dragging them to new positions
 * @param options - Configuration options for drag and drop
 * @returns Object with drag state and event handlers
 */
export const useDragAndDrop = ({
  itemLayout,
  onLayoutChange,
  enabled = true,
}: UseDragAndDropOptions): UseDragAndDropResult => {
  const [dragState, setDragState] = useState<DragState>(initialDragState);
  const layoutRef = useRef(itemLayout);
  layoutRef.current = itemLayout;

  /**
   * Start dragging an item
   */
  const handleDragStart = useCallback(
    (item: string, row: number, col: number) => {
      if (!enabled || !item || item === "blank") return;

      setDragState({
        draggedFrom: { col, row },
        draggedItem: item,
        dropTarget: null,
        isDragging: true,
      });
    },
    [enabled],
  );

  /**
   * Handle drag over a potential drop target
   */
  const handleDragOver = useCallback(
    (e: React.DragEvent, row: number, col: number) => {
      if (!enabled || !dragState.isDragging) return;

      e.preventDefault();
      e.dataTransfer.dropEffect = "move";

      // Only update if the drop target changed
      if (
        dragState.dropTarget?.row !== row ||
        dragState.dropTarget?.col !== col
      ) {
        setDragState((prev) => ({
          ...prev,
          dropTarget: { col, row },
        }));
      }
    },
    [enabled, dragState.isDragging, dragState.dropTarget],
  );

  /**
   * Handle leaving a drop target
   */
  const handleDragLeave = useCallback(() => {
    if (!enabled) return;

    setDragState((prev) => ({
      ...prev,
      dropTarget: null,
    }));
  }, [enabled]);

  /**
   * Handle dropping an item at a new position
   */
  const handleDrop = useCallback(
    (row: number, col: number) => {
      if (!enabled || !dragState.isDragging || !dragState.draggedFrom) {
        setDragState(initialDragState);
        return;
      }

      const { draggedFrom } = dragState;

      // Don't do anything if dropping in the same place
      if (draggedFrom.row === row && draggedFrom.col === col) {
        setDragState(initialDragState);
        return;
      }

      // Create new layout with swapped items
      const newLayout = layoutRef.current.map((rowItems) => [...rowItems]);
      const fromItem = newLayout[draggedFrom.row][draggedFrom.col];
      const toItem = newLayout[row][col];

      // Swap items
      newLayout[draggedFrom.row][draggedFrom.col] = toItem;
      newLayout[row][col] = fromItem;

      // Notify parent of layout change
      onLayoutChange(newLayout);

      // Reset drag state
      setDragState(initialDragState);
    },
    [enabled, dragState, onLayoutChange],
  );

  /**
   * Handle drag end (cleanup)
   */
  const handleDragEnd = useCallback(() => {
    setDragState(initialDragState);
  }, []);

  /**
   * Check if a position is the current drop target
   */
  const isDropTarget = useCallback(
    (row: number, col: number) => {
      return (
        dragState.dropTarget?.row === row && dragState.dropTarget?.col === col
      );
    },
    [dragState.dropTarget],
  );

  /**
   * Check if a position is being dragged
   */
  const isDraggedItem = useCallback(
    (row: number, col: number) => {
      return (
        dragState.draggedFrom?.row === row && dragState.draggedFrom?.col === col
      );
    },
    [dragState.draggedFrom],
  );

  return {
    dragState,
    handleDragEnd,
    handleDragLeave,
    handleDragOver,
    handleDragStart,
    handleDrop,
    isDraggedItem,
    isDropTarget,
  };
};
