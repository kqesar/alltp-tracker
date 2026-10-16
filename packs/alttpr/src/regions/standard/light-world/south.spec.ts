// The branches of the South Light World that upstream's tests cannot reach:
// they run with swords. And what the player sees, which upstream does not
// model. The contract covers the rest (test/contract.spec.ts).
import { compileWorld, loadRules, type State, solve } from "@alltp/engine";
import { describe, expect, it } from "vitest";
import { compile, regionModules, STATE_NAMES } from "../../../pack";
import { RULES } from "../../../rules";
import {
  type AlttprSettings,
  OPEN,
  settingsFromUpstream,
} from "../../../settings";
import { buildWorld, START } from "../../../world";

const BOMBOS = "bombos-tablet";

/**
 * The run's world with the South Dark World entered from the start: the
 * tablet's rule then reads as this module writes it, whatever the Dark
 * World's own ways in need.
 */
function withSouthDarkWorld(settings: AlttprSettings) {
  const modules = regionModules(settings).map((module) => ({
    ...module,
    regions: module.regions.map((region) =>
      region.id === "southDarkWorld"
        ? {
            ...region,
            entrances: [{ from: START, req: "true", source: "game" as const }],
          }
        : region,
    ),
  }));
  return compileWorld(buildWorld(modules), loadRules(RULES), {
    items: STATE_NAMES,
    settings,
  });
}

const LEDGE: State = { bookOfMudora: 1, magicMirror: 1, rescueZelda: 1 };

describe("South Light World", () => {
  it("reads the Bombos tablet with the hammer in swordless only", () => {
    const swordless = settingsFromUpstream("open", {
      "mode.weapons": "swordless",
    });
    const at = (settings: AlttprSettings, state: State) =>
      solve(withSouthDarkWorld(settings), state).location(BOMBOS);
    expect(at(swordless, { ...LEDGE, hammer: 1 })).toBe("yes");
    expect(at(swordless, LEDGE)).toBe("no");
    expect(at(OPEN, { ...LEDGE, hammer: 1 })).toBe("no");
    expect(at(OPEN, { ...LEDGE, sword: 2 })).toBe("yes");
    expect(at(OPEN, { ...LEDGE, sword: 1 })).toBe("no");
    expect(at(OPEN, { hammer: 1, rescueZelda: 1, sword: 2 })).toBe("no");
  });

  it("shows the Bombos tablet's item to the Book on its ledge, sword or not", () => {
    const world = withSouthDarkWorld(OPEN);
    const reader = solve(world, LEDGE);
    expect(reader.location(BOMBOS)).toBe("no");
    expect(reader.visible(BOMBOS)).toBe("yes");
    expect(solve(world, { ...LEDGE, bookOfMudora: 0 }).visible(BOMBOS)).toBe(
      "no",
    );
    expect(solve(world, { ...LEDGE, magicMirror: 0 }).visible(BOMBOS)).toBe(
      "no",
    );
  });

  it("shows the Desert Ledge and Lake Hylia Island from below", () => {
    const world = compile(OPEN);
    const walker = solve(world, { rescueZelda: 1 });
    for (const id of ["desert-ledge", "lake-hylia-island"]) {
      expect(walker.location(id), id).toBe("no");
      expect(walker.visible(id), id).toBe("yes");
      expect(solve(world, {}).visible(id), id).toBe("no");
    }
    expect(
      solve(world, { bookOfMudora: 1, rescueZelda: 1 }).location(
        "desert-ledge",
      ),
    ).toBe("yes");
  });
});
