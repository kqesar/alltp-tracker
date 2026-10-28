import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { TrackerGrid } from "@/games/alttpr/components/tracker/TrackerGrid";
import {
  CLAMPED_ITEMS,
  items,
  itemsMax,
  itemsMin,
} from "@/games/alttpr/data/items";
import {
  CONTROLS,
  type ControlId,
  dungeonOf,
  isKeyControl,
  isMapCompassControl,
} from "@/games/alttpr/data/keymap";
import { getPreset } from "@/games/alttpr/data/presets";
import { useItemShortcuts } from "@/games/alttpr/hooks/useItemShortcuts";
import { smallKeysMax } from "@/games/alttpr/logic/settings";
import { useGameStore } from "@/games/alttpr/stores/gameStore";

/** The grid cell a control is drawn in: its own, its boss's or its key cell. */
const cellOf = (control: ControlId) => {
  const index = dungeonOf(control);
  if (index === null) return control;
  return isKeyControl(control) ? `keys${index}` : `boss${index}`;
};

/** The control's cell alone, with the shortcuts listening. */
const Board = ({ control }: { control: ControlId }) => {
  useItemShortcuts();
  return <TrackerGrid itemLayout={[[cellOf(control)]]} />;
};

/** How many values a control cycles through. */
const statesOf = (control: ControlId) => {
  const [, kind, index] = /^(smallkey|medallion)(\d+)$/.exec(control) ?? [];
  if (kind === "smallkey") return smallKeysMax(Number(index)) + 1;
  if (kind === "medallion") return 4;
  if (typeof items[control] === "boolean") return 2;
  return itemsMax[control] - itemsMin[control] + 1;
};

/** The grid button a control is drawn as. */
const testIdOf = (control: ControlId) => {
  const [, kind, index] =
    /^(chest|reward|medallion|bigkey|smallkey|map|compass)(\d+)$/.exec(
      control,
    ) ?? [];
  switch (kind) {
    case "chest":
    case "reward":
    case "medallion":
      return `${kind}-overlay-${index}`;
    case "map":
    case "compass":
      return `${kind}-${index}`;
    case "bigkey":
      return `big-key-${index}`;
    case "smallkey":
      return `small-key-${index}`;
    default:
      return `item-${control}`;
  }
};

/** Everything a grid control can change. */
const snapshot = () => {
  const { items, medallions, smallKeys } = useGameStore.getState();
  return { items, medallions, smallKeys };
};

/**
 * A fresh run, key cells shown, `control` alone bound to K and Shift+K: a
 * keysanity run for a map or a compass, which only it shows, and a retro
 * run for a shop.
 */
const freshRun = (control: ControlId) =>
  act(() => {
    useGameStore.setState(useGameStore.getInitialState(), true);
    const presetId = isMapCompassControl(control)
      ? "keysanity"
      : control.startsWith("shop")
        ? "retro"
        : null;
    if (presetId !== null) {
      useGameStore.setState({
        presetId,
        settings: getPreset(presetId).settings,
      });
    }
    useGameStore.getState().setBigKeysVisible(true);
    useGameStore.getState().setKeymap({
      [`advance:${control}`]: "KeyK",
      [`back:${control}`]: "Shift+KeyK",
    });
  });

describe("a shortcut steps its control exactly as a click does", () => {
  it.each(CONTROLS)(
    "%s: forward as a click, back as a right-click",
    async (control) => {
      // No pause between events: hundreds of them, nothing timed to wait for
      const user = userEvent.setup({ delay: null });
      // One step more than the control has values: it wraps both ways
      const steps = statesOf(control) + 1;
      freshRun(control);
      render(<Board control={control} />);

      const clicked = [];
      const target = screen.getByTestId(testIdOf(control));
      for (let step = 0; step < steps; step++) {
        await user.click(target);
        clicked.push(snapshot());
      }
      for (let step = 0; step < steps; step++) {
        await user.pointer({ keys: "[MouseRight]", target });
        clicked.push(snapshot());
      }

      freshRun(control);
      const pressed = [];
      for (let step = 0; step < steps; step++) {
        await user.keyboard("k");
        pressed.push(snapshot());
      }
      for (let step = 0; step < steps; step++) {
        await user.keyboard("{Shift>}k{/Shift}");
        pressed.push(snapshot());
      }

      expect(pressed).toEqual(clicked);
      // The clicks did move the control, so equal runs prove something
      expect(
        new Set(clicked.map((run) => JSON.stringify(run))).size,
      ).toBeGreaterThan(1);
      // One undoable step per press that moved it: a counter that stops at
      // its ends (CLAMPED_ITEMS, the hearts) does not move past them
      const ends = CLAMPED_ITEMS.has(control) ? 2 : 0;
      expect(useGameStore.getState().past).toHaveLength(2 * (steps - ends));
    },
  );
});
