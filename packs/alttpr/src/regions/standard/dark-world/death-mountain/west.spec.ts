// The branch of Spike Cave that upstream's tests cannot reach: they never
// set region.cantTakeDamage. The contract covers the rest
// (test/contract.spec.ts).
import { type State, solve } from "@alltp/engine";
import { describe, expect, it } from "vitest";
import { compile } from "../../../../pack";
import {
  type AlttprSettings,
  OPEN,
  settingsFromUpstream,
} from "../../../../settings";

const SPIKE_CAVE = "spike-cave";
/** At the cave's door, as Link. */
const DOOR = { flute: 1, glove: 1, hammer: 1, moonPearl: 1, rescueZelda: 1 };

const at = (settings: AlttprSettings, state: State) =>
  solve(compile(settings), state).location(SPIKE_CAVE);

describe("Spike Cave", () => {
  it("takes the hits under the Cane of Byrna, unless the world forbids damage", () => {
    const noDamage = settingsFromUpstream("open", {
      "region.cantTakeDamage": true,
    });
    const byrna = { ...DOOR, caneOfByrna: 1 };
    expect(at(OPEN, byrna)).toBe("yes");
    expect(at(noDamage, byrna)).toBe("no");
    expect(at(noDamage, { ...byrna, bottle: 1 })).toBe("yes");
    expect(at(noDamage, { ...byrna, magic: 1 })).toBe("yes");
  });

  it("wants the magic to keep the cape on, whatever the world", () => {
    const cape = { ...DOOR, cape: 1 };
    expect(at(OPEN, cape)).toBe("no");
    expect(at(OPEN, { ...cape, magic: 1 })).toBe("yes");
  });
});
