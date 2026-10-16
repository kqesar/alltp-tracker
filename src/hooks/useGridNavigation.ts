import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/**
 * Where a control sits in the item grid. A cell can hold several controls (a
 * boss and its overlays, a big key and the small keys); `slot` orders them,
 * 0 being the cell's main control.
 */
export type GridPosition = { row: number; col: number; slot: number };

type GridFocus = {
  /** Key of the one control the Tab key enters the grid on */
  active: string;
  setActive: (key: string) => void;
};

const keyOf = ({ row, col, slot }: GridPosition) => `${row}:${col}:${slot}`;

const GridFocusContext = createContext<GridFocus | null>(null);

export const GridFocusProvider = GridFocusContext.Provider;

/**
 * The attributes a grid control spreads onto its `<button>`: its position for
 * the arrow keys, and a roving tab index, so the whole grid is a single Tab
 * stop that remembers the last control used.
 * @param position - The control's place in the grid
 */
export const useGridFocusable = (position: GridPosition) => {
  const focus = useContext(GridFocusContext);
  const key = keyOf(position);
  return {
    "data-grid-col": position.col,
    "data-grid-row": position.row,
    "data-grid-slot": position.slot,
    onFocus: () => focus?.setActive(key),
    // Outside a grid (a component rendered on its own) stay reachable by Tab
    tabIndex: !focus || focus.active === key ? 0 : -1,
  };
};

/** Every control the arrow keys can land on, in DOM (reading) order. */
const controlsIn = (container: HTMLElement) => [
  ...container.querySelectorAll<HTMLButtonElement>(
    "button[data-grid-row]:not(:disabled)",
  ),
];

const positionOf = (element: HTMLElement): GridPosition => ({
  col: Number(element.dataset.gridCol),
  row: Number(element.dataset.gridRow),
  slot: Number(element.dataset.gridSlot ?? 0),
});

/**
 * Arrow-key navigation for the item grid. Left / Right step through the
 * controls of a row in reading order (a boss's overlays included) and wrap;
 * Up / Down go to the nearest column of the next row and wrap; Home / End jump
 * to the ends of the row, or of the grid with Ctrl.
 */
export const useGridNavigation = () => {
  const containerRef = useRef<HTMLElement>(null);
  const [active, setActive] = useState(keyOf({ col: 0, row: 0, slot: 0 }));

  // When the control holding the tab stop disappears (key cells hidden), hand
  // the tab stop to the first control so the grid stays reachable.
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (
      !container ||
      container.querySelector('[data-grid-row][tabindex="0"]')
    ) {
      return;
    }
    const [first] = controlsIn(container);
    if (first) setActive(keyOf(positionOf(first)));
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const current = (event.target as HTMLElement).closest<HTMLElement>(
        "button[data-grid-row]",
      );
      if (!current) return;

      const controls = controlsIn(container);
      const here = positionOf(current);
      const row = (index: number) =>
        controls.filter((control) => positionOf(control).row === index);
      const rows = [...new Set(controls.map((c) => positionOf(c).row))];
      const sameRow = row(here.row);
      const step = (list: HTMLButtonElement[], by: number) =>
        list[
          (list.indexOf(current as HTMLButtonElement) + by + list.length) %
            list.length
        ];

      // The control of `list` closest to the current column, main control first
      const nearest = (list: HTMLButtonElement[]) =>
        list.reduce((best, control) => {
          const a = positionOf(control);
          const b = positionOf(best);
          const distance =
            Math.abs(a.col - here.col) - Math.abs(b.col - here.col);
          return distance < 0 || (distance === 0 && a.slot < b.slot)
            ? control
            : best;
        });
      const otherRow = (by: number) => {
        const index = rows.indexOf(here.row);
        return row(rows[(index + by + rows.length) % rows.length]);
      };

      let target: HTMLButtonElement | undefined;
      switch (event.key) {
        case "ArrowLeft":
          target = step(sameRow, -1);
          break;
        case "ArrowRight":
          target = step(sameRow, 1);
          break;
        case "ArrowUp":
          target = nearest(otherRow(-1));
          break;
        case "ArrowDown":
          target = nearest(otherRow(1));
          break;
        case "Home":
          target = event.ctrlKey ? controls[0] : sameRow[0];
          break;
        case "End":
          target = event.ctrlKey ? controls.at(-1) : sameRow.at(-1);
          break;
        default:
          return;
      }

      event.preventDefault();
      target?.focus();
    };

    container.addEventListener("keydown", onKeyDown);
    return () => container.removeEventListener("keydown", onKeyDown);
  }, []);

  const focus = useMemo(() => ({ active, setActive }), [active]);

  return { containerRef, focus };
};
