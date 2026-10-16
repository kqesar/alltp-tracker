// The branches of Hyrule Castle Tower that upstream's tests cannot reach:
// they run with swords and the lamp rule on, and check one way in and out.
// The contract covers the rest (test/contract.spec.ts).
import { type State, solve } from "@alltp/engine";
import { describe, expect, it } from "vitest";
import { compile } from "../../pack";
import {
  type AlttprSettings,
  OPEN,
  settingsFromUpstream,
} from "../../settings";

const TOWER = "hyruleCastleTower";
const AGAHNIM = "agahnim";
const SWORDLESS = settingsFromUpstream("open", { "mode.weapons": "swordless" });

const solved = (settings: AlttprSettings, state: State) =>
  solve(compile(settings), state);

describe("Hyrule Castle Tower", () => {
  it("opens to the Cape or the Master Sword, and to the hammer in swordless", () => {
    const base = { bow: 1, rescueZelda: 1 };
    expect(solved(OPEN, { ...base, cape: 1 }).region(TOWER)).toBe("yes");
    expect(solved(OPEN, { ...base, sword: 2 }).region(TOWER)).toBe("yes");
    expect(solved(OPEN, { ...base, sword: 1 }).region(TOWER)).toBe("no");
    expect(solved(OPEN, { ...base, hammer: 1 }).region(TOWER)).toBe("no");
    expect(solved(SWORDLESS, { ...base, hammer: 1 }).region(TOWER)).toBe("yes");
    // Eight enemies to kill on the way, and Zelda rescued first
    expect(solved(OPEN, { cape: 1, rescueZelda: 1 }).region(TOWER)).toBe("no");
    expect(solved(OPEN, { bow: 1, cape: 1 }).region(TOWER)).toBe("no");
  });

  it("beats Agahnim with a sword, or the hammer or the net in swordless", () => {
    const top = { cape: 1, keyA1: 2, lamp: 1, rescueZelda: 1 };
    expect(solved(OPEN, { ...top, sword: 1 }).location(AGAHNIM)).toBe("yes");
    expect(solved(OPEN, { ...top, hammer: 1 }).location(AGAHNIM)).toBe("no");
    expect(solved(SWORDLESS, { ...top, hammer: 1 }).location(AGAHNIM)).toBe(
      "yes",
    );
    expect(
      solved(SWORDLESS, { ...top, bow: 1, bugCatchingNet: 1 }).location(
        AGAHNIM,
      ),
    ).toBe("yes");
    expect(solved(SWORDLESS, { ...top, bow: 1 }).location(AGAHNIM)).toBe("no");
    // Both keys of the tower
    expect(solved(OPEN, { ...top, keyA1: 1, sword: 1 }).location(AGAHNIM)).toBe(
      "no",
    );
  });

  it("asks for no lamp in the dark maze or before Agahnim when the customizer drops the rule", () => {
    const noLamp = settingsFromUpstream("open", { "item.require.Lamp": 0 });
    const inside = { cape: 1, keyA1: 2, rescueZelda: 1, sword: 1 };
    expect(solved(noLamp, inside).location("castle-tower/dark-maze")).toBe(
      "yes",
    );
    expect(solved(OPEN, inside).location("castle-tower/dark-maze")).toBe("no");
    expect(solved(noLamp, inside).location(AGAHNIM)).toBe("yes");
    expect(solved(OPEN, inside).location(AGAHNIM)).toBe("no");
  });
});
