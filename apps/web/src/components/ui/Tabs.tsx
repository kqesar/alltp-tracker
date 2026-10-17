import { type KeyboardEvent, useRef } from "react";

/** A tab: the value it selects and its words. */
export type Tab<T extends string> = {
  readonly value: T;
  readonly label: string;
};

/** The id of a tab, for its panel's aria-labelledby. */
export const tabId = (baseId: string, value: string) =>
  `${baseId}-tab-${value}`;

/**
 * A tab list (the ARIA tabs pattern, automatic activation): a click, the
 * arrow keys, Home or End select a tab; only the selected one is in the tab
 * order. The panel it controls is the caller's, labelled by `tabId`.
 * @param baseId - Prefix of the tabs' ids
 * @param panelId - The id of the panel the tabs control
 * @param testId - Prefix of the tabs' test ids, `<testId>-<value>`; the
 * list's is `<testId>s`
 */
export const Tabs = <T extends string>({
  baseId,
  label,
  onSelect,
  panelId,
  selected,
  tabs,
  testId,
}: {
  baseId: string;
  label: string;
  onSelect: (value: T) => void;
  panelId: string;
  selected: T;
  tabs: readonly Tab<T>[];
  testId: string;
}) => {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const moves: Record<string, number> = {
      ArrowLeft: index - 1,
      ArrowRight: index + 1,
      End: tabs.length - 1,
      Home: 0,
    };
    if (!(event.key in moves)) return;
    event.preventDefault();
    const next = (moves[event.key] + tabs.length) % tabs.length;
    onSelect(tabs[next].value);
    buttons.current[next]?.focus();
  };

  return (
    <div
      aria-label={label}
      className="tabs"
      data-testid={`${testId}s`}
      role="tablist"
    >
      {tabs.map(({ label: words, value }, index) => (
        <button
          aria-controls={panelId}
          aria-selected={value === selected}
          className="tabs__tab"
          data-testid={`${testId}-${value}`}
          id={tabId(baseId, value)}
          key={value}
          onClick={() => onSelect(value)}
          onKeyDown={(event) => onKeyDown(event, index)}
          ref={(element) => {
            buttons.current[index] = element;
          }}
          role="tab"
          tabIndex={value === selected ? 0 : -1}
          type="button"
        >
          {words}
        </button>
      ))}
    </div>
  );
};
