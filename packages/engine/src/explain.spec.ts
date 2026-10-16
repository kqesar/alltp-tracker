import { describe, expect, it } from "vitest";
import type { State, TraceNode } from "./evaluate";
import { explain } from "./explain";
import { print } from "./printer";
import { loadRules } from "./rules";
import { compileWorld, type World } from "./world";

/** A trace as nested `"requirement: value"` strings, children after. */
const compact = (node: TraceNode): unknown => {
  const label = `${print(node.expr)}: ${node.value}`;
  return node.children.length === 0
    ? label
    : [label, ...node.children.map(compact)];
};

describe("explain", () => {
  const rules = loadRules({ helpers: { canLight: "firerod | lantern" } });
  // Two ways into the vault: the long way through the cellar (hammer, key)
  // and a dark shortcut straight from the gate.
  const world: World = {
    regions: [
      {
        exits: [{ to: "hall" }, { req: "?lantern", to: "vault" }],
        id: "gate",
        locations: [{ id: "sign" }],
      },
      {
        exits: [{ req: "hammer", to: "cellar" }],
        id: "hall",
        locations: [{ id: "peek", req: "reach(cellar) & ?mirror" }],
      },
      { exits: [{ req: "key", to: "vault" }], id: "cellar" },
      {
        id: "vault",
        locations: [{ id: "treasure", req: "bow & @canLight | boots" }],
      },
      { id: "island", locations: [{ id: "lost" }] },
    ],
    start: "gate",
  };
  const compiled = compileWorld(world, rules);
  const pathOf = (state: State, id: string) =>
    explain(compiled, state, id).path;

  it("follows a chain of exits, each with its value", () => {
    expect(pathOf({ hammer: true, key: true }, "treasure")).toEqual([
      { region: "gate" },
      { exit: { from: "gate", req: "true", value: "yes" }, region: "hall" },
      { exit: { from: "hall", req: "hammer", value: "yes" }, region: "cellar" },
      { exit: { from: "cellar", req: "key", value: "yes" }, region: "vault" },
    ]);
  });

  it("shows the maybe exit when the only way in is a maybe", () => {
    expect(pathOf({}, "treasure")).toEqual([
      { region: "gate" },
      {
        exit: { from: "gate", req: "?lantern", value: "maybe" },
        region: "vault",
      },
    ]);
  });

  it("keeps the best path: the shortcut while the long way is blocked", () => {
    // The hammer opens the cellar, but without the key the vault is still
    // only the dark shortcut.
    expect(pathOf({ hammer: true }, "treasure").map((s) => s.region)).toEqual([
      "gate",
      "vault",
    ]);
    // With the lantern both ways are yes; the first one found is kept.
    expect(
      pathOf({ hammer: true, key: true, lantern: true }, "treasure"),
    ).toEqual([
      { region: "gate" },
      {
        exit: { from: "gate", req: "?lantern", value: "yes" },
        region: "vault",
      },
    ]);
  });

  it("has a one-step path at the start and none out of reach", () => {
    expect(pathOf({}, "sign")).toEqual([{ region: "gate" }]);
    expect(pathOf({ hammer: true, key: true }, "lost")).toEqual([]);
  });

  it("traces the requirement node by node, without short-circuits", () => {
    const { requirement } = explain(
      compiled,
      { bow: true, lantern: true },
      "treasure",
    );
    expect(requirement.value).toBe("yes");
    expect(compact(requirement)).toEqual([
      "bow & @canLight | boots: yes",
      [
        "bow & @canLight: yes",
        "bow: yes",
        [
          "@canLight: yes",
          ["firerod | lantern: yes", "firerod: no", "lantern: yes"],
        ],
      ],
      // Evaluated although the first branch already settled the result.
      "boots: no",
    ]);
  });

  it("traces reach() with the region's level", () => {
    expect(compact(explain(compiled, {}, "peek").requirement)).toEqual([
      "reach(cellar) & ?mirror: no",
      "reach(cellar): no",
      ["?mirror: maybe", "mirror: no"],
    ]);
    expect(
      compact(explain(compiled, { hammer: true }, "peek").requirement),
    ).toEqual([
      "reach(cellar) & ?mirror: maybe",
      "reach(cellar): yes",
      ["?mirror: maybe", "mirror: no"],
    ]);
  });

  it("explains the requirement with the world's settings folded in", () => {
    const hard = compileWorld(
      {
        regions: [
          {
            id: "r",
            locations: [{ id: "l", req: "!setting(hard) & bow | boots" }],
          },
        ],
        start: "r",
      },
      undefined,
      { settings: { hard: true } },
    );
    expect(compact(explain(hard, {}, "l").requirement)).toBe("boots: no");
  });

  it("rejects an id the world does not have", () => {
    expect(() => explain(compiled, {}, "nothing")).toThrow(
      'Unknown location "nothing"',
    );
  });
});
