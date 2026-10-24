import { memo, useId, useMemo, useState, useSyncExternalStore } from "react";
import {
  type CheckRow,
  type CheckZone,
  checkZones,
  groupsFor,
  visibleZones,
} from "@/games/archipelago/checks";
import { itemLabel } from "@/games/archipelago/itemLabel";
import { useApNamesStore } from "@/games/archipelago/names";
import { useArchipelagoStore } from "@/games/archipelago/store";
import { useSkin } from "@/games/archipelago/worlds/skins";

/**
 * Where the board stacks its panels (archipelago.css): there every group
 * starts closed, so the checks never run the page long on a phone.
 */
const NARROW = "(max-width: 60rem)";

const isNarrow = () =>
  typeof window.matchMedia === "function" && window.matchMedia(NARROW).matches;

/** Calls back when the board starts or stops stacking (a resize, a rotation). */
const onNarrowChange = (callback: () => void) => {
  if (typeof window.matchMedia !== "function") return () => {};
  const query = window.matchMedia(NARROW);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
};

/** The groups open until the player opens or closes one: those with checks left. */
const openByDefault = (
  zones: readonly CheckZone[],
  narrow: boolean,
): ReadonlySet<string> =>
  narrow
    ? new Set()
    : new Set(
        zones
          .filter((zone) => zone.rows.some((row) => !row.checked))
          .map((zone) => zone.name),
      );

/** One location: done or not, in words and by a glyph, never by colour alone. */
const Row = memo(({ held, row }: { held?: string; row: CheckRow }) => (
  <li
    className="ap-check"
    data-checked={row.checked}
    data-testid={`ap-check-${row.id}`}
  >
    <span aria-hidden="true" className="ap-check__glyph">
      {row.checked ? "✓" : "○"}
    </span>
    <span className="ap-check__name">
      {row.name}
      <span className="sr-only">
        , {row.checked ? "checked" : "not checked"}
      </span>
      {held !== undefined && (
        <span className="ap-check__held" data-testid="ap-check-held">
          <span className="sr-only">, held </span>
          {held}
        </span>
      )}
    </span>
  </li>
));

/**
 * What each checked location held ("What I sent", from the server's
 * LocationInfo): the item's name, and whose it was when not the slot's own.
 */
const useHeld = (): ReadonlyMap<number, string> => {
  const sent = useArchipelagoStore((state) => state.sent);
  const players = useArchipelagoStore((state) => state.players);
  const me = useArchipelagoStore((state) => state.room?.slot);
  return useMemo(() => {
    const by = new Map(players.map((player) => [player.slot, player]));
    return new Map(
      sent.map(({ item, location, to }) => {
        const words = itemLabel(by.get(to)?.game, item);
        return [
          location,
          to === me
            ? words
            : `${words} for ${by.get(to)?.name ?? `Player ${to}`}`,
        ];
      }),
    );
  }, [sent, players, me]);
};

/**
 * The slot's own locations by the world's groups, as the server states them:
 * how many are left, a filter, and "Hide checked". Each group is a
 * disclosure, "Group — n left / m": those with checks left open by default,
 * every one closed where the board stacks (a phone), and every one a filter
 * matches open while it does. Nothing to tick: the server says what is
 * checked, and nothing here says what is reachable.
 */
export const ChecksPanel = () => {
  const checked = useArchipelagoStore((state) => state.checked);
  const missing = useArchipelagoStore((state) => state.missing);
  const hideChecked = useArchipelagoStore((state) => state.prefs.hideChecked);
  const setHideChecked = useArchipelagoStore((state) => state.setHideChecked);
  const names = useApNamesStore((state) => state.names);
  const serverGroups = useApNamesStore((state) => state.groups);
  const skin = useSkin(useArchipelagoStore((state) => state.room?.game));
  const groups = groupsFor(serverGroups, skin?.groups);
  const [filter, setFilter] = useState("");
  /** The groups the player opened, once they opened or closed one. */
  const [chosen, setChosen] = useState<ReadonlySet<string> | null>(null);
  const id = useId();
  const held = useHeld();
  const zones = useMemo(
    () => checkZones(checked, missing, names, groups),
    [checked, missing, names, groups],
  );
  const shown = useMemo(
    () => visibleZones(zones, filter, hideChecked),
    [zones, filter, hideChecked],
  );
  const counts = useMemo(
    () =>
      new Map(
        zones.map((zone) => [
          zone.name,
          {
            left: zone.rows.filter((row) => !row.checked).length,
            total: zone.rows.length,
          },
        ]),
      ),
    [zones],
  );
  // Until the player chooses, the defaults follow the board stacking or not
  const narrow = useSyncExternalStore(onNarrowChange, isNarrow);
  const opened = chosen ?? openByDefault(zones, narrow);
  const filtering = filter.trim() !== "";
  const total = checked.length + missing.length;
  const rows = shown.reduce((sum, zone) => sum + zone.rows.length, 0);

  /** The player opened or closed a group (a filter opens them on its own). */
  const toggle = (name: string, open: boolean) => {
    if (filtering || opened.has(name) === open) return;
    const next = new Set(opened);
    if (open) next.add(name);
    else next.delete(name);
    setChosen(next);
  };

  return (
    <div className="ap-checks" data-testid="ap-checks">
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
          >
            {shown.length === 0 ? (
              <p className="ap-panel__empty">No location to show.</p>
            ) : (
              shown.map((zone) => {
                const count = counts.get(zone.name);
                return (
                  <details
                    className="ap-checks__zone"
                    data-testid={`ap-zone-${zone.name}`}
                    key={zone.name}
                    onToggle={(event) =>
                      toggle(zone.name, event.currentTarget.open)
                    }
                    open={filtering || opened.has(zone.name)}
                  >
                    <summary className="ap-checks__summary">
                      <span className="ap-checks__zone-name">{zone.name}</span>{" "}
                      <span className="ap-checks__zone-count">
                        — {count?.left} left / {count?.total}
                      </span>
                    </summary>
                    <ul className="ap-checks__list">
                      {zone.rows.map((row) => (
                        <Row
                          held={row.checked ? held.get(row.id) : undefined}
                          key={row.id}
                          row={row}
                        />
                      ))}
                    </ul>
                  </details>
                );
              })
            )}
          </section>
        </>
      )}
    </div>
  );
};
