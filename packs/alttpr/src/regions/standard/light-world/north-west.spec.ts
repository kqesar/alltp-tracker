// The branches of the North West Light World that upstream's tests cannot
// reach: they run with no item placement. The contract covers the rest
// (test/contract.spec.ts).
import { type State, solve } from "@alltp/engine";
import { describe, expect, it } from "vitest";
import { compile } from "../../../pack";
import {
  type AlttprSettings,
  OPEN,
  settingsFromUpstream,
  UPSTREAM_TEST,
} from "../../../settings";

const PEDESTAL = "master-sword-pedestal";
const PENDANTS = {
  pendantOfCourage: 1,
  pendantOfPower: 1,
  pendantOfWisdom: 1,
  rescueZelda: 1,
} as const;

const at = (settings: AlttprSettings, state: State, id: string) =>
  solve(compile(settings), state).location(id);

describe("North West Light World", () => {
  it("wants the Book for the pedestal in the basic placement only", () => {
    const basic = settingsFromUpstream("open", { itemPlacement: "basic" });
    expect(at(basic, PENDANTS, PEDESTAL)).toBe("no");
    expect(at(basic, { ...PENDANTS, bookOfMudora: 1 }, PEDESTAL)).toBe("yes");
    expect(at(OPEN, PENDANTS, PEDESTAL)).toBe("yes");
    expect(at(UPSTREAM_TEST, PENDANTS, PEDESTAL)).toBe("yes");
    const two = { ...PENDANTS, bookOfMudora: 1, pendantOfPower: 0 };
    expect(at(basic, two, PEDESTAL)).toBe("no");
  });

  it("shows the pedestal's item to whoever reads it with the Book", () => {
    const world = compile(OPEN);
    const reader = solve(world, { bookOfMudora: 1, rescueZelda: 1 });
    expect(reader.location(PEDESTAL)).toBe("no");
    expect(reader.visible(PEDESTAL)).toBe("yes");
    expect(solve(world, { rescueZelda: 1 }).visible(PEDESTAL)).toBe("no");
    expect(solve(world, { bookOfMudora: 1 }).visible(PEDESTAL)).toBe("no");
  });
});
