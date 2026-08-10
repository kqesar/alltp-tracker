import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TrackerGrid } from "@/components/tracker/TrackerGrid";

/**
 * Exercises arrow-key navigation against a real rendered grid: the hook only
 * listens on the container, so driving it any other way proves nothing.
 */

const layout = [
  ["bow", "", "hammer"],
  ["sword", "boots", "flute"],
];

/** Grid position of whatever currently has focus. */
const focusedCell = () => {
  const active = document.activeElement;
  return active
    ? [
        active.getAttribute("data-grid-row"),
        active.getAttribute("data-grid-col"),
      ]
    : null;
};

/** Focus a cell and tell the hook where focus now is. */
const startAt = (row: number, col: number) => {
  const button = document.querySelector<HTMLButtonElement>(
    `[data-grid-row="${row}"][data-grid-col="${col}"]`,
  );
  button?.focus();
  // onFocus feeds updateFocusPosition, which arrow keys move from.
  fireEvent.focus(button as HTMLButtonElement);
};

const pressArrow = (key: string) => {
  fireEvent.keyDown(document.getElementById("itemdiv") as HTMLElement, { key });
};

describe("grid keyboard navigation", () => {
  it("moves right and left along a row", () => {
    render(<TrackerGrid itemLayout={layout} />);
    startAt(1, 0);

    pressArrow("ArrowRight");
    expect(focusedCell()).toEqual(["1", "1"]);

    pressArrow("ArrowLeft");
    expect(focusedCell()).toEqual(["1", "0"]);
  });

  it("moves down and up a column", () => {
    render(<TrackerGrid itemLayout={layout} />);
    startAt(0, 0);

    pressArrow("ArrowDown");
    expect(focusedCell()).toEqual(["1", "0"]);

    pressArrow("ArrowUp");
    expect(focusedCell()).toEqual(["0", "0"]);
  });

  it("skips over empty cells", () => {
    render(<TrackerGrid itemLayout={layout} />);
    startAt(0, 0);

    // Column 1 of row 0 is empty, so the jump lands on column 2.
    pressArrow("ArrowRight");
    expect(focusedCell()).toEqual(["0", "2"]);
  });

  it("continues onto the next row past the last column, wrapping at the end", () => {
    render(<TrackerGrid itemLayout={layout} />);
    startAt(0, 2);

    // Row 0 is the last populated column, so it carries on into row 1.
    pressArrow("ArrowRight");
    expect(focusedCell()).toEqual(["1", "0"]);

    // From the last cell of the last row it comes back to the very first.
    startAt(1, 2);
    pressArrow("ArrowRight");
    expect(focusedCell()).toEqual(["0", "0"]);
  });

  it("wraps upward from the top row to the bottom", () => {
    render(<TrackerGrid itemLayout={layout} />);
    startAt(0, 0);

    pressArrow("ArrowUp");
    expect(focusedCell()).toEqual(["1", "0"]);
  });

  it("leaves focus alone for keys it does not handle", () => {
    render(<TrackerGrid itemLayout={layout} />);
    startAt(1, 1);

    pressArrow("a");
    expect(focusedCell()).toEqual(["1", "1"]);
  });

  it("renders every non-empty cell as a focusable button", () => {
    render(<TrackerGrid itemLayout={layout} />);

    // Five items, one empty cell.
    expect(screen.getAllByRole("button")).toHaveLength(5);
  });
});
