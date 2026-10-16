// The branches of Open's escape that upstream's tests cannot reach: they run
// with no item placement and the lamp rule on. The contract covers the rest
// (test/contract.spec.ts).
import { type State, solve } from "@alltp/engine";
import { describe, expect, it } from "vitest";
import { compile } from "../../pack";
import {
  type AlttprSettings,
  OPEN,
  settingsFromUpstream,
  UPSTREAM_TEST,
} from "../../settings";

const DARK_CROSS = "sewers/dark-cross";
const SECRET_ROOM = [
  "sewers/secret-room/left",
  "sewers/secret-room/middle",
  "sewers/secret-room/right",
];

const UPSTREAM_OPEN = settingsFromUpstream("open", {
  difficulty: "test_rules",
  logic: "NoGlitches",
});

const at = (settings: AlttprSettings, state: State, id: string) =>
  solve(compile(settings), state).location(id);

describe("Hyrule Castle Escape (Open)", () => {
  it("lights the sewers with the Fire Rod in the advanced placement only", () => {
    const basic = settingsFromUpstream("open", { itemPlacement: "basic" });
    expect(at(OPEN, { fireRod: 1 }, DARK_CROSS)).toBe("yes");
    expect(at(UPSTREAM_OPEN, { fireRod: 1 }, DARK_CROSS)).toBe("no");
    expect(at(basic, { fireRod: 1 }, DARK_CROSS)).toBe("no");
    expect(at(basic, { lamp: 1 }, DARK_CROSS)).toBe("yes");
    for (const id of SECRET_ROOM) {
      expect(at(OPEN, { fireRod: 1, keyH2: 1 }, id), id).toBe("yes");
      expect(at(OPEN, { fireRod: 1 }, id), id).toBe("no");
      expect(at(basic, { fireRod: 1, keyH2: 1 }, id), id).toBe("no");
    }
  });

  it("asks for no lamp when the customizer drops the rule", () => {
    const noLamp = settingsFromUpstream("open", { "item.require.Lamp": 0 });
    expect(at(noLamp, {}, DARK_CROSS)).toBe("yes");
    expect(at(OPEN, {}, DARK_CROSS)).toBe("no");
    for (const id of SECRET_ROOM) {
      expect(at(noLamp, { keyH2: 1 }, id), id).toBe("yes");
      expect(at(OPEN, { keyH2: 1 }, id), id).toBe("no");
    }
  });

  it("is the Open world's own: rules the Standard escape does not have", () => {
    // Open's Sanctuary is free, Standard's wants a weapon and the key
    expect(at(UPSTREAM_OPEN, {}, "sanctuary")).toBe("yes");
    expect(at(UPSTREAM_TEST, {}, "sanctuary")).toBe("no");
    // Zelda has no can_complete in Open
    expect(at(UPSTREAM_OPEN, {}, "zelda")).toBe("yes");
    expect(at(UPSTREAM_TEST, {}, "zelda")).toBe("no");
  });
});
