import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { KeyChord } from "@/components/ui/KeyChord";
import { chests } from "@/data/chests";
import { dungeons } from "@/data/dungeons";
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
import { buildDungeonCaption } from "@/data/logic";
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
import { parseCaption } from "@/utils/caption";

/** Gap between the tooltip and its anchor, and the tooltip and the viewport edge. */
const GAP = 8;

/** The caption a target shows, from the current game state. */
const captionFor = (target: TooltipTarget, medallions: number[]): string => {
  switch (target.kind) {
    case "chest":
      return chests[target.index].name;
    case "dungeon":
      return buildDungeonCaption(
        dungeons[target.index],
        target.index,
        medallions,
      );
    case "item":
      return itemLabels(target.item);
  }
};

/** The grid controls a target's tooltip lists the shortcuts of. */
const controlsOf = (target: TooltipTarget): ControlId[] => {
  switch (target.kind) {
    case "chest":
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
 * when there is room, below otherwise, kept inside the viewport. Its text is
 * already in the control's accessible name, so it is hidden from assistive
 * technology. It follows WCAG 1.4.13: Escape dismisses it, the pointer can
 * move onto it, and it stays until the pointer or focus leaves. It takes no
 * pointer events itself, so it never swallows a press meant for the control
 * it covers (a boss's tooltip lies over the cell above): whether the pointer
 * is on it is told by position, and a press there hides it and acts on the
 * control underneath.
 */
export const Tooltip = () => {
  const target = useTooltipStore((state) => state.target);
  const anchor = useTooltipStore((state) => state.anchor);
  const medallions = useGameStore((state) => state.medallions);
  const shortcuts = useGameStore((state) => state.shortcuts);
  const ref = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);

  const caption = target ? captionFor(target, medallions) : "";
  const lines = target ? shortcutLines(target, shortcuts) : [];

  // Measure after rendering the new text, then place it before paint.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the caption and the keys change the size to measure
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
      top: fitsAbove ? box.top - height - GAP : box.bottom + GAP,
    });
  }, [anchor, caption, lines.length]);

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
      className={`tooltip tooltip--${placement?.side ?? "above"}`}
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
      {parseCaption(caption).map((part, index) =>
        typeof part === "string" ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: parts of one static caption, never reordered
          <span key={index}>{part}</span>
        ) : (
          <img
            alt=""
            className="mini"
            // biome-ignore lint/suspicious/noArrayIndexKey: parts of one static caption, never reordered
            key={index}
            src={getAssetPath(`${part.icon}.png`)}
          />
        ),
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
