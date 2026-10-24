import { memo, useId, useMemo, useState } from "react";
import {
  type CheckRow,
  checkZones,
  visibleZones,
} from "@/games/archipelago/checks";
import { useApNamesStore } from "@/games/archipelago/names";
import { useArchipelagoStore } from "@/games/archipelago/store";

/** One location: done or not, in words and by a glyph, never by colour alone. */
const Row = memo(({ row }: { row: CheckRow }) => (
  <li
    className="ap-check"
    data-checked={row.checked}
    data-testid={`ap-check-${row.id}`}
  >
    <span aria-hidden="true" className="ap-check__glyph">
      {row.checked ? "✓" : "○"}
    </span>
    <span className="ap-check__name">{row.name}</span>
    <span className="sr-only">, {row.checked ? "checked" : "not checked"}</span>
  </li>
));

/**
 * The slot's own locations by the world's groups, as the server states them:
 * how many are left, a filter, and "Hide checked". Nothing to tick: the
 * server says what is checked, and nothing here says what is reachable.
 */
export const ChecksPanel = () => {
  const checked = useArchipelagoStore((state) => state.checked);
  const missing = useArchipelagoStore((state) => state.missing);
  const hideChecked = useArchipelagoStore((state) => state.prefs.hideChecked);
  const setHideChecked = useArchipelagoStore((state) => state.setHideChecked);
  const names = useApNamesStore((state) => state.names);
  const groups = useApNamesStore((state) => state.groups);
  const [filter, setFilter] = useState("");
  const id = useId();
  const zones = useMemo(
    () => checkZones(checked, missing, names, groups),
    [checked, missing, names, groups],
  );
  const shown = useMemo(
    () => visibleZones(zones, filter, hideChecked),
    [zones, filter, hideChecked],
  );
  const total = checked.length + missing.length;
  const rows = shown.reduce((sum, zone) => sum + zone.rows.length, 0);

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="ap-panel ap-checks"
      data-testid="ap-checks"
    >
      <h2 className="ap-panel__heading" id={`${id}-title`}>
        Checks
      </h2>
      <p className="ap-checks__note" id={`${id}-note`}>
        Archipelago's server says what you checked. It does not say what you can
        reach.
      </p>
      {total > 0 && (
        <p className="ap-checks__left" data-testid="ap-checks-left">
          {missing.length} left / {total}
        </p>
      )}
      {names === null ? (
        <p className="ap-panel__empty" data-testid="ap-checks-waiting">
          {total === 0
            ? "No room yet."
            : "Location names load once the board reaches the room."}
        </p>
      ) : (
        <>
          <div className="checks__tools">
            <label className="checks__field">
              Filter
              <input
                aria-describedby={`${id}-note`}
                className="checks__input"
                data-testid="ap-checks-filter"
                onChange={(event) => setFilter(event.target.value)}
                type="search"
                value={filter}
              />
            </label>
            <label className="checks__field ap-checks__hide">
              <input
                checked={hideChecked}
                data-testid="ap-checks-hide"
                onChange={(event) => setHideChecked(event.target.checked)}
                type="checkbox"
              />
              Hide checked
            </label>
          </div>
          <p className="sr-only" role="status">
            {filter === "" && !hideChecked
              ? ""
              : `${rows} ${rows === 1 ? "location" : "locations"} shown`}
          </p>
          <section
            aria-label="Locations"
            className="ap-checks__zones"
            data-testid="ap-checks-zones"
            // Scrolls on its own beside the items: the keyboard scrolls it too
            // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrolling region
            tabIndex={0}
          >
            {shown.length === 0 ? (
              <p className="ap-panel__empty">No location to show.</p>
            ) : (
              shown.map((zone, index) => (
                <section
                  aria-labelledby={`${id}-zone-${index}`}
                  className="ap-checks__zone"
                  key={zone.name}
                >
                  <h3 className="checks-zone__title" id={`${id}-zone-${index}`}>
                    {zone.name}{" "}
                    <span className="checks-zone__count">
                      {zone.rows.filter((row) => !row.checked).length} left
                    </span>
                  </h3>
                  <ul className="ap-checks__list">
                    {zone.rows.map((row) => (
                      <Row key={row.id} row={row} />
                    ))}
                  </ul>
                </section>
              ))
            )}
          </section>
        </>
      )}
    </section>
  );
};
