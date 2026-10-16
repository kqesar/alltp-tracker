import { LEGACY_DUNGEONS, type MapMarker } from "@alltp/pack-alttpr";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { KeyChord } from "@/components/ui/KeyChord";
import { itemLabels } from "@/data/items";
import {
  type Chord,
  type ControlId,
  controlName,
  dungeonControls,
  isBindable,
  isKeyControl,
  type ShortcutPrefs,
} from "@/data/keymap";
import {
  dungeonCount,
  itemsSurelyInLogic,
  locationLabel,
  type MarkerState,
  markerById,
  markerDetail,
} from "@/logic/solution";
import { useGameStore } from "@/stores/gameStore";
import {
  cancelHide,
  isOnTooltip,
  scheduleHide,
  setTooltipElement,
  type TooltipTarget,
  useTooltipStore,
} from "@/stores/tooltipStore";
import { getAssetPath } from "@/utils";

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
    const id = LEGACY_DUNGEONS[target.index];
    return id === undefined ? undefined : markerById(id);
  }
  return undefined;
};

const NO_DETAIL: MarkerState[] = [];

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
 * marker's lists each location it stands for with its state, and a
 * dungeon's says how many items its counter has left and how many of those
 * are surely in logic. The marker's accessible name says its state, so the
 * tooltip is hidden from assistive technology. It follows WCAG 1.4.13:
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
  const ref = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);

  const title =
    marker?.name ?? (target?.kind === "item" ? itemLabels(target.item) : "");
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
  const size = `${title}|${left}|${sure}|${pad}|${detail.join()}|${lines.length}`;

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

  return (
    <div
      aria-hidden="true"
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
      <span className="tooltip__title">{title}</span>
      {pad !== undefined && (
        <span className="tooltip__pad">
          <img
            alt=""
            className="mini"
            src={getAssetPath(`medallion${pad}.png`)}
          />
          {MEDALLION_NAMES[pad]}
        </span>
      )}
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
      {rows.length > 0 && (
        <ul
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
      )}
      {lines.length > 0 && (
        <span className="tooltip__keys" data-testid="tooltip-keys">
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
