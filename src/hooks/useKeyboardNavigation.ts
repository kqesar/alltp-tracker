import { useCallback, useEffect, useRef } from "react";
import { GRID_CONSTANTS, KEYBOARD_NAVIGATION } from "@/constants";

type GridPosition = {
  row: number;
  col: number;
};

type UseKeyboardNavigationProps = {
  /** Total number of rows in the grid */
  totalRows: number;
  /** Layout data to determine valid positions */
  itemLayout: string[][];
  /** Whether keyboard navigation is enabled */
  enabled?: boolean;
};

/**
 * Hook to manage keyboard navigation within the tracker grid
 * Provides arrow key navigation, Tab sequences, and focus management
 * @param totalRows - Total number of rows in the grid
 * @param itemLayout - 2D array representing the grid layout
 * @param enabled - Whether keyboard navigation is enabled (default: true)
 */
export const useKeyboardNavigation = ({
  totalRows,
  itemLayout,
  enabled = true,
}: UseKeyboardNavigationProps) => {
  const containerRef = useRef<HTMLElement>(null);
  const currentFocusRef = useRef<GridPosition>({ col: 0, row: 0 });

  /**
   * Get the button element at a specific grid position
   * @param row - Grid row index
   * @param col - Grid column index
   * @returns The button element or null if not found
   */
  const getButtonAtPosition = useCallback(
    (row: number, col: number): HTMLButtonElement | null => {
      if (!containerRef.current) return null;

      // Find button with matching row and col data attributes
      const button = containerRef.current.querySelector(
        `button[data-grid-row="${row}"][data-grid-col="${col}"]`,
      ) as HTMLButtonElement;

      return button;
    },
    [],
  );

  /**
   * Check if a grid position is valid (has an item and is not disabled)
   * @param row - Grid row index
   * @param col - Grid column index
   * @returns Whether the position is valid for focus
   */
  const isValidPosition = useCallback(
    (row: number, col: number): boolean => {
      // Check bounds
      if (
        row < 0 ||
        row >= totalRows ||
        col < 0 ||
        col >= GRID_CONSTANTS.ITEMS_PER_ROW
      ) {
        return false;
      }

      // Check if item exists in layout
      const rowData = itemLayout[row];
      if (!rowData || col >= rowData.length) {
        return false;
      }

      const item = rowData[col];
      if (!item || item === "blank" || item === "") {
        return false;
      }

      // Check if button exists and is not disabled
      const button = getButtonAtPosition(row, col);
      return button !== null && !button.disabled;
    },
    [totalRows, itemLayout, getButtonAtPosition],
  );

  /**
   * Find the next valid position in a given direction
   * @param currentRow - Current row position
   * @param currentCol - Current column position
   * @param deltaRow - Row change (-1, 0, 1)
   * @param deltaCol - Column change (-1, 0, 1)
   * @returns Next valid position or null if none found
   */
  const findNextValidPosition = useCallback(
    (
      currentRow: number,
      currentCol: number,
      deltaRow: number,
      deltaCol: number,
    ): GridPosition | null => {
      let newRow = currentRow + deltaRow;
      let newCol = currentCol + deltaCol;

      // Wrap around for horizontal movement
      if (deltaCol !== 0) {
        const maxAttempts = totalRows * GRID_CONSTANTS.ITEMS_PER_ROW;
        let attempts = 0;

        while (attempts < maxAttempts) {
          // Handle column wrapping
          if (newCol >= GRID_CONSTANTS.ITEMS_PER_ROW) {
            newCol = 0;
            newRow = (newRow + 1) % totalRows;
          } else if (newCol < 0) {
            newCol = GRID_CONSTANTS.ITEMS_PER_ROW - 1;
            newRow = newRow - 1 < 0 ? totalRows - 1 : newRow - 1;
          }

          if (isValidPosition(newRow, newCol)) {
            return { col: newCol, row: newRow };
          }

          newCol += deltaCol;
          attempts++;
        }
      } else {
        // Vertical movement
        const maxAttempts = totalRows;
        let attempts = 0;

        while (attempts < maxAttempts) {
          if (newRow >= totalRows) {
            newRow = 0;
          } else if (newRow < 0) {
            newRow = totalRows - 1;
          }

          if (isValidPosition(newRow, newCol)) {
            return { col: newCol, row: newRow };
          }

          newRow += deltaRow;
          attempts++;
        }
      }

      return null;
    },
    [totalRows, isValidPosition],
  );

  /**
   * Move focus to a specific grid position
   * @param row - Target row
   * @param col - Target column
   */
  const focusPosition = useCallback(
    (row: number, col: number): void => {
      const button = getButtonAtPosition(row, col);
      if (button && isValidPosition(row, col)) {
        button.focus();
        currentFocusRef.current = { col, row };
      }
    },
    [getButtonAtPosition, isValidPosition],
  );

  /**
   * Handle keyboard navigation events
   * @param event - Keyboard event
   */
  const handleKeyDown = useCallback(
    (event: KeyboardEvent): void => {
      if (!enabled || !containerRef.current) return;

      const { row: currentRow, col: currentCol } = currentFocusRef.current;
      let nextPosition: GridPosition | null = null;

      switch (event.key) {
        case KEYBOARD_NAVIGATION.ARROW_UP:
          event.preventDefault();
          nextPosition = findNextValidPosition(currentRow, currentCol, -1, 0);
          break;

        case KEYBOARD_NAVIGATION.ARROW_DOWN:
          event.preventDefault();
          nextPosition = findNextValidPosition(currentRow, currentCol, 1, 0);
          break;

        case KEYBOARD_NAVIGATION.ARROW_LEFT:
          event.preventDefault();
          nextPosition = findNextValidPosition(currentRow, currentCol, 0, -1);
          break;

        case KEYBOARD_NAVIGATION.ARROW_RIGHT:
          event.preventDefault();
          nextPosition = findNextValidPosition(currentRow, currentCol, 0, 1);
          break;

        default:
          return;
      }

      if (nextPosition) {
        focusPosition(nextPosition.row, nextPosition.col);
      }
    },
    [enabled, findNextValidPosition, focusPosition],
  );

  /**
   * Update current focus position when focus changes
   * @param row - New focus row
   * @param col - New focus column
   */
  const updateFocusPosition = useCallback((row: number, col: number): void => {
    currentFocusRef.current = { col, row };
  }, []);

  /**
   * Focus the first valid item in the grid
   */
  const focusFirstItem = useCallback((): void => {
    for (let row = 0; row < totalRows; row++) {
      for (let col = 0; col < GRID_CONSTANTS.ITEMS_PER_ROW; col++) {
        if (isValidPosition(row, col)) {
          focusPosition(row, col);
          return;
        }
      }
    }
  }, [totalRows, isValidPosition, focusPosition]);

  // Set up keyboard event listeners
  useEffect(() => {
    if (!enabled || !containerRef.current) return;

    const container = containerRef.current;
    container.addEventListener("keydown", handleKeyDown);

    return () => {
      container.removeEventListener("keydown", handleKeyDown);
    };
  }, [enabled, handleKeyDown]);

  return {
    containerRef,
    get currentFocus() {
      return currentFocusRef.current;
    },
    focusFirstItem,
    focusPosition,
    updateFocusPosition,
  };
};
