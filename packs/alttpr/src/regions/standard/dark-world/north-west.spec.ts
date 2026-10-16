// The branches of North West Dark World that upstream's tests cannot reach:
// they run with no item placement, so the basic placement's hookshot and
// mirror never come up. Also what the player sees from the road below
// Bumper Cave. The contract covers the rest (test/contract.spec.ts).
import { type State, solve } from "@alltp/engine";
import { describe, expect, it } from "vitest";
import { compile } from "../../../pack";
import {
  type AlttprSettings,
  OPEN,
  settingsFromUpstream,
  UPSTREAM_TEST,
} from "../../../settings";

/** In North West Dark World by the dark rocks. */
const THERE = { glove: 2, moonPearl: 1, rescueZelda: 1 } as const;

const BASIC = settingsFromUpstream("open", { itemPlacement: "basic" });

const solved = (settings: AlttprSettings, state: State) =>
  solve(compile(settings), state);

describe("North West Dark World", () => {
  it("wants the hookshot for Bumper Cave with the basic placement", () => {
    const cape = { ...THERE, cape: 1 };
    expect(solved(OPEN, cape).location("bumper-cave")).toBe("yes");
    expect(solved(BASIC, cape).location("bumper-cave")).toBe("no");
    expect(
      solved(BASIC, { ...cape, hookshot: 1 }).location("bumper-cave"),
    ).toBe("yes");
  });

  it("wants the mirror for the Blacksmith and the Purple Chest with the basic placement", () => {
    for (const id of ["blacksmith", "purple-chest"]) {
      expect(solved(OPEN, THERE).location(id)).toBe("yes");
      expect(solved(BASIC, THERE).location(id)).toBe("no");
      expect(solved(BASIC, { ...THERE, magicMirror: 1 }).location(id)).toBe(
        "yes",
      );
    }
  });

  it("shows Bumper Cave's item from the road below", () => {
    const below = solved(UPSTREAM_TEST, THERE);
    expect(below.location("bumper-cave")).toBe("no");
    expect(below.visible("bumper-cave")).toBe("yes");
    // Not from the Light World
    expect(
      solved(UPSTREAM_TEST, { rescueZelda: 1 }).visible("bumper-cave"),
    ).toBe("no");
  });
});
