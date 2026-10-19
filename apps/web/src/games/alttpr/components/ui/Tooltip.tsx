import type { MapMarker } from "@alltp/pack-alttpr";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { KeyChord } from "@/games/alttpr/components/ui/KeyChord";
import { MissingLines } from "@/games/alttpr/components/ui/Missing";
import { itemLabels } from "@/games/alttpr/data/items";
import {
  type Chord,
  type ControlId,
  controlName,
  dungeonControls,
  isBindable,
  isKeyControl,
  type ShortcutPrefs,
} from "@/games/alttpr/data/keymap";
import { useCurrentAnalysis } from "@/games/alttpr/hooks/useRunAnalysis";
import type { Missing, RunAnalysis } from "@/games/alttpr/logic/missing";
import { KEY_DUNGEONS } from "@/games/alttpr/logic/settings";
import {
  bossStateOf,
  dungeonCount,
  itemsSurelyInLogic,
  locationLabel,
  type MarkerState,
  markerById,
  markerDetail,
  prizeOf,
} from "@/games/alttpr/logic/solution";
import { useGameStore } from "@/games/alttpr/stores/gameStore";
import { getAssetPath } from "@/games/alttpr/utils";
import {
  cancelHide,
  isOnTooltip,
  scheduleHide,
  setTooltipElement,
  type TooltipTarget,
  useTooltipStore,
} from "@/stores/tooltipStore";

/** Gap between the tooltip and its anchor, and the tooltip and the viewport edge. */
const GAP = 8;

/** A list this long is laid out in two columns. */
const COLUMNS_FROM = 10;

/** How the tooltip words a location's state, beside its glyph. */
const STATE_TEXT: Record<MarkerState, string> = {
  available: "Available",
  opened: "Done",
  possible: "Maybe",
  seen: "Visible, not reachable yet",
  unavailable: "Out of logic",
};

/** The medallion each value of the store's `medallions` names. */
const MEDALLION_NAMES = ["Unknown medallion", "Bombos", "Ether", "Quake"];

/** The grid slot of the medallion pad a dungeon asks for, if any. */
const PAD_SLOTS: Partial<Record<string, number>> = {
  "misery-mire": 8,
  "turtle-rock": 9,
};

/** The map marker a target describes: its own, or its dungeon cell's. */
const markerOf = (target: TooltipTarget | null): MapMarker | undefined => {
  if (target?.kind === "marker") return markerById(target.id);
  if (target?.kind === "dungeon") {
    const id = KEY_DUNGEONS[target.index];
    return id === undefined ? undefined : markerById(id);
  }
  return undefined;
};

const NO_DETAIL: MarkerState[] = [];

/** The id of the tooltip's detail, which describes the control it is for. */
export const TOOLTIP_DETAIL_ID = "tooltip-detail";

/** What some of a marker's checks are missing, the same for each. */
type MissingEntry = {
  key: string;
  /** Which checks, when the marker's others miss something else */
  label?: string;
  missing: Missing;
};

/**
 * What a marker's checks left are missing: for a dungeon, its boss's (the
 * prize's rule) until beaten; for a cave, each location's, those missing the
 * same thing together, named when not all its checks left miss it.
 */
const missingOf = (
  marker: MapMarker,
  rows: readonly { id: string; label: string; state: MarkerState }[],
  analysis: RunAnalysis,
  boss: MarkerState | undefined,
): MissingEntry[] => {
  if (marker.dungeon !== undefined) {
    if (boss === "opened" || boss === "available") return [];
    const missing = analysis.missing.get(
      prizeOf(marker.dungeon, analysis.solution.settings),
    );
    return missing ? [{ key: "boss", label: "Boss", missing }] : [];
  }
  const left = rows.filter((row) => row.state !== "opened");
  const groups = new Map<string, { labels: string[]; missing: Missing }>();
  for (const row of left) {
    const missing = analysis.missing.get(row.id);
    if (missing === undefined) continue;
    const same = JSON.stringify(missing);
    const group = groups.get(same) ?? { labels: [], missing };
    group.labels.push(row.label);
    groups.set(same, group);
  }
  // Unnamed when every check left misses the same thing
  const named = [...groups.values()].some(
    (group) => group.labels.length !== left.length,
  );
  return [...groups.entries()].map(([key, { labels, missing }]) => ({
    key,
    label: named ? labels.join(", ") : undefined,
    missing,
  }));
};

/** The grid controls a target's tooltip lists the shortcuts of. */
const controlsOf = (target: TooltipTarget): ControlId[] => {
  switch (target.kind) {
    case "marker":
      return [];
    case "dungeon":
      // The boss cell's controls, the one the tooltip points at first
      return dungeonControls(target.index).filter(
        (control) => !isKeyControl(control),
      );
    case "item":
      return [target.item];
    case "text":
      return [];
  }
};

type ShortcutLine = {
  control: ControlId;
  /** Said for a dungeon's controls, which share one tooltip */
  name?: string;
  forward?: Chord;
  back?: Chord;
};

/** The bound shortcuts of a target's controls, while shortcuts are on. */
const shortcutLines = (
  target: TooltipTarget,
  shortcuts: ShortcutPrefs,
): ShortcutLine[] => {
  if (!shortcuts.enabled) return [];
  const usable = (chord?: Chord) =>
    chord && isBindable(chord) ? chord : undefined;
  return controlsOf(target)
    .map((control) => ({
      back: usable(shortcuts.keymap[`back:${control}`]),
      control,
      forward: usable(shortcuts.keymap[`advance:${control}`]),
      name: target.kind === "dungeon" ? controlName(control) : undefined,
    }))
    .filter((line) => line.forward || line.back);
};

type Placement = { left: number; top: number; side: "above" | "below" };

/**
 * The page's single tooltip, anchored to the control it describes: above it
 * when there is room, below otherwise, kept inside the viewport. A map
 * marker's lists each location it stands for with its state and what those
 * not in logic are missing, and a dungeon's says how many items its counter
 * has left, how many of those are surely in logic, and what its boss is
 * missing. The marker's accessible name says its state, so its title is
 * hidden from assistive technology; the rest, which the name does not say,
 * is a `role="tooltip"` detail that describes the marker (aria-describedby)
 * while shown. What is missing comes from the run's analysis, worked out
 * when the browser was idle: hovering solves nothing. It follows WCAG 1.4.13:
 * Escape dismisses it, the pointer can move onto it, and it stays until
 * the pointer or focus leaves. It takes no pointer events itself, so it
 * never swallows a press meant for the control it covers (a boss's tooltip
 * lies over the cell above): whether the pointer is on it is told by
 * position, and a press there hides it and acts on the control underneath.
 */
export const Tooltip = () => {
  const target = useTooltipStore((state) => state.target);
  const anchor = useTooltipStore((state) => state.anchor);
  const shortcuts = useGameStore((state) => state.shortcuts);
  const marker = markerOf(target);
  const dungeon = marker?.dungeon;
  const detail = useGameStore(
    useShallow((state) =>
      marker === undefined ? NO_DETAIL : markerDetail(marker, state),
    ),
  );
  const left = useGameStore((state) =>
    dungeon === undefined ? undefined : dungeonCount(dungeon, state),
  );
  const sure = useGameStore((state) =>
    dungeon === undefined ? 0 : itemsSurelyInLogic(dungeon, state),
  );
  const pad = useGameStore((state) => {
    const slot = dungeon === undefined ? undefined : PAD_SLOTS[dungeon];
    return slot === undefined ? undefined : (state.medallions[slot] ?? 0) % 4;
  });
  const boss = useGameStore((state) =>
    dungeon === undefined ? undefined : bossStateOf(dungeon, state),
  );
  // Worked out when the browser was idle: a hover only reads it
  const analysis = useCurrentAnalysis();
  const ref = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);

  const title =
    marker?.name ??
    (target?.kind === "item"
      ? itemLabels(target.item)
      : target?.kind === "text"
        ? target.title
        : "");
  const text = target?.kind === "text" ? target.text : "";
  const lines = target ? shortcutLines(target, shortcuts) : [];
  // One row per location, but for a marker that stands for one only: its
  // state then follows its name
  // A dungeon counted down to 0 has nothing left anywhere in it
  const rows =
    marker === undefined
      ? []
      : marker.locations.map((id, index) => {
          const state =
            left === 0 ? "opened" : (detail[index] ?? "unavailable");
          return {
            id,
            label:
              marker.locations.length > 1 || dungeon !== undefined
                ? locationLabel(marker, id)
                : STATE_TEXT[state],
            state,
          };
        });
  const wide = rows.length >= COLUMNS_FROM;
  const missing =
    marker === undefined || analysis === undefined
      ? []
      : missingOf(marker, rows, analysis, boss);
  // The marker's name says the state of a one-location marker: its row
  // stays out of the description
  const single = rows.length === 1 && dungeon === undefined;
  const described = left !== undefined || !single || missing.length > 0;
  const hasDetail = marker !== undefined && described;
  const size = `${title}|${text}|${left}|${sure}|${pad}|${detail.join()}|${lines.length}|${missing.map((entry) => entry.key).join()}`;

  // The detail is what the anchor's name does not say: it describes it
  useLayoutEffect(() => {
    if (!anchor || !hasDetail) return;
    const before = anchor.getAttribute("aria-describedby");
    anchor.setAttribute("aria-describedby", TOOLTIP_DETAIL_ID);
    return () => {
      if (before === null) anchor.removeAttribute("aria-describedby");
      else anchor.setAttribute("aria-describedby", before);
    };
  }, [anchor, hasDetail]);

  // Measure after rendering the new text, then place it before paint.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the text and the keys change the size to measure
  useLayoutEffect(() => {
    const tooltip = ref.current;
    if (!anchor || !tooltip) {
      setPlacement(null);
      return;
    }
    const box = anchor.getBoundingClientRect();
    const { width, height } = tooltip.getBoundingClientRect();
    const fitsAbove = box.top - height - GAP >= GAP;
    const centred = box.left + box.width / 2 - width / 2;
    setPlacement({
      left: Math.min(Math.max(centred, GAP), window.innerWidth - width - GAP),
      side: fitsAbove ? "above" : "below",
      top: fitsAbove
        ? box.top - height - GAP
        : Math.max(
            GAP,
            Math.min(box.bottom + GAP, window.innerHeight - height - GAP),
          ),
    });
  }, [anchor, size]);

  // Dismiss on Escape, on a press off its anchor (touch has no hover to
  // leave), and when the page scrolls or resizes from under it. Stay while
  // the mouse is on it; once it leaves for anything but the anchor, go.
  useEffect(() => {
    if (!anchor) return;
    const hide = () => useTooltipStore.getState().hide();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") hide();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!anchor.contains(event.target as Node)) hide();
    };
    let hovered = false;
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const onTooltip = isOnTooltip(event.clientX, event.clientY);
      if (onTooltip === hovered) return;
      hovered = onTooltip;
      if (onTooltip) cancelHide();
      else if (!anchor.contains(event.target as Node)) scheduleHide(anchor);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("scroll", hide, { capture: true, passive: true });
    window.addEventListener("resize", hide);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("scroll", hide, { capture: true });
      window.removeEventListener("resize", hide);
    };
  }, [anchor]);

  if (!target || !anchor) return null;

  const checks = rows.length > 0 && (
    <ul
      aria-hidden={single || undefined}
      className={`tooltip__checks${wide ? " tooltip__checks--columns" : ""}`}
      data-testid="tooltip-checks"
    >
      {rows.map(({ id, label, state }) => (
        <li className={`tooltip__check tooltip__check--${state}`} key={id}>
          <span className={`tooltip__glyph state-glyph ${state}`} />
          <span className="tooltip__label">{label}</span>
        </li>
      ))}
    </ul>
  );

  return (
    <div
      className={`tooltip tooltip--${placement?.side ?? "above"}${wide ? " tooltip--wide" : ""}`}
      data-testid="tooltip"
      ref={(element) => {
        ref.current = element;
        setTooltipElement(element);
      }}
      style={
        placement
          ? { left: placement.left, top: placement.top }
          : { visibility: "hidden" }
      }
    >
      {/* What the control's own name says stays out of the a11y tree */}
      <span aria-hidden="true" className="tooltip__title">
        {title}
      </span>
      {pad !== undefined && (
        <span aria-hidden="true" className="tooltip__pad">
          <img
            alt=""
            className="mini"
            src={getAssetPath(`medallion${pad}.png`)}
          />
          {MEDALLION_NAMES[pad]}
        </span>
      )}
      {text !== "" && (
        <span aria-hidden="true" className="tooltip__text">
          {text}
        </span>
      )}
      {single && checks}
      {hasDetail && (
        <div
          className="tooltip__detail"
          data-testid="tooltip-detail"
          id={TOOLTIP_DETAIL_ID}
          role="tooltip"
        >
          {left !== undefined && (
            <span className="tooltip__count" data-testid="tooltip-count">
              {left === 0
                ? "No item left"
                : left === 1
                  ? "1 item left"
                  : `${left} items left`}
              {sure > 0 && `, at least ${sure} in logic`}
            </span>
          )}
          {!single && checks}
          {missing.map((entry) => (
            <div
              className="tooltip__missing"
              data-testid="tooltip-missing"
              key={entry.key}
            >
              {entry.label && (
                <span className="tooltip__missing-for">{entry.label}</span>
              )}
              <MissingLines missing={entry.missing} />
            </div>
          ))}
        </div>
      )}
      {lines.length > 0 && (
        <span
          aria-hidden="true"
          className="tooltip__keys"
          data-testid="tooltip-keys"
        >
          {lines.map(({ back, control, forward, name }) => (
            <span className="tooltip__shortcut" key={control}>
              {name && <span className="tooltip__key-name">{name}</span>}
              {forward && <KeyChord chord={forward} />}
              {back && (
                <>
                  <span className="tooltip__key-name">back</span>
                  <KeyChord chord={back} />
                </>
              )}
            </span>
          ))}
        </span>
      )}
    </div>
  );
};
