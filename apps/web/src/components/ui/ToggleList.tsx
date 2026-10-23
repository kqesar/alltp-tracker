import type { ReactNode } from "react";

/** One toggle of a `ToggleList`. */
export type ToggleItem = {
  id: string;
  name: string;
  /** Whether it is on: done, found, held */
  on: boolean;
  testId: string;
};

/**
 * A panel under a board's grid of toggles, each an `aria-pressed` button with
 * a check glyph: a heading, a polite summary of how many are on, and the
 * list. The Super Metroid seed's objectives and SMZ3's boss tokens.
 * @param className - What the game styles on its own panel
 * @param testId - The panel's `data-testid`, which the heading's id and the
 * summary's `data-testid` extend
 * @param summary - The words under the heading, announced as they change
 * @param onToggle - What a click does to a toggle
 */
export const ToggleList = ({
  className,
  items,
  onToggle,
  summary,
  testId,
  title,
}: {
  className: string;
  items: readonly ToggleItem[];
  onToggle: (item: ToggleItem) => void;
  summary: ReactNode;
  testId: string;
  title: string;
}) => (
  <section
    aria-labelledby={`${testId}-heading`}
    className={`board-panel ${className}`}
    data-testid={testId}
  >
    <h2 className="board-panel__heading" id={`${testId}-heading`}>
      {title}
    </h2>
    <p
      aria-live="polite"
      className="board-panel__summary"
      data-testid={`${testId}-summary`}
    >
      {summary}
    </p>
    {items.length > 0 && (
      <ul className="board-panel__list">
        {items.map((item) => (
          <li key={item.id}>
            <button
              aria-pressed={item.on}
              className="toggle-chip"
              data-testid={item.testId}
              onClick={() => onToggle(item)}
              type="button"
            >
              <span aria-hidden="true" className="toggle-chip__check">
                {item.on ? "✓" : ""}
              </span>
              {item.name}
            </button>
          </li>
        ))}
      </ul>
    )}
  </section>
);
