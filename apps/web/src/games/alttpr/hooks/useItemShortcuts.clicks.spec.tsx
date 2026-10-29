import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { TrackerGrid } from "@/games/alttpr/components/tracker/TrackerGrid";
import {
  BOTTLE_CONTENTS,
  bottleSlotOf,
  CAPACITIES,
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
import {
  knownBossIndex,
  knownBossValues,
} from "@/games/alttpr/logic/knownBosses";
import { smallKeysMax } from "@/games/alttpr/logic/settings";
import { useGameStore } from "@/games/alttpr/stores/gameStore";

/**
 * The grid cell a control is drawn in: its own, its boss's or its key cell.
 */
const cellOf = (control: ControlId) => {
  // The arrows' capacity rides on the bow's cell
  if (control === "arrowcapacity") return "bow";
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
  const [, kind, index] =
    /^(smallkey|medallion|knownboss)(\d+)$/.exec(control) ?? [];
  if (kind === "smallkey") return smallKeysMax(Number(index)) + 1;
  if (kind === "medallion") return 4;
  // Not known, then the bosses its slot can hold
  if (kind === "knownboss") {
    return knownBossValues(Number(index), useGameStore.getState().settings)
      .length;
  }
  // Not set, then the 3 starting hearts to 20 a quarter at a time
  if (control === "hearts") return 1 + 4 * (itemsMax.hearts - 1) + 1;
  // A capacity's steps of 5; a bottle not found, then what it holds
  const capacity = CAPACITIES[control];
  if (capacity) return (capacity.top - capacity.start) / 5 + 1;
  if (bottleSlotOf(control) !== null) return BOTTLE_CONTENTS.length + 1;
  if (typeof items[control] === "boolean") return 2;
  return itemsMax[control] - itemsMin[control] + 1;
};

/** The grid button a control is drawn as. */
const testIdOf = (control: ControlId) => {
  const [, kind, index] =
    /^(chest|reward|medallion|bigkey|smallkey|map|compass|knownboss)(\d+)$/.exec(
      control,
    ) ?? [];
  switch (kind) {
    case "knownboss":
      return `known-boss-overlay-${index}`;
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
 * keysanity run for a map or a compass, which only it shows, a retro run
 * for a shop and a triforce hunt for the pieces.
 */
const freshRun = (control: ControlId) =>
  act(() => {
    useGameStore.setState(useGameStore.getInitialState(), true);
    const presetId = isMapCompassControl(control)
      ? "keysanity"
      : control.startsWith("shop")
        ? "retro"
        : control === "triforce"
          ? "triforce-hunt"
          : null;
    if (presetId !== null) {
      useGameStore.setState({
        presetId,
        settings: getPreset(presetId).settings,
      });
    }
    // A dungeon's known boss shows while its bosses may move
    if (knownBossIndex(control) !== null) {
      useGameStore.setState({
        settings: { ...getPreset("open").settings, bossShuffle: "full" },
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
      const fresh = snapshot();
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
      // its ends (the hearts, heartsAfter) does not move past them
      // (the triforce pieces too: none and the most a goal holds)
      // (a bottle from empty goes, then stays gone)
      const moves = pressed.filter(
        (run, step) =>
          JSON.stringify(run) !== JSON.stringify(pressed[step - 1] ?? fresh),
      ).length;
      expect(moves).toBeGreaterThanOrEqual(steps);
      expect(useGameStore.getState().past).toHaveLength(moves);
    },
  );
});
