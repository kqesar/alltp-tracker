// Every atom the pack's rules read, in every world the app compiles, held
// to what the board can say: an item the board can record up to the level a
// rule asks, a count it may not know read as maybe while unknown, or a
// reviewed exception. A rule that starts reading anything else fails here,
// before a run shows a check out of logic for good (the basic placement's
// hearts did: `@hasHealth7` over hearts no cell recorded).
import {
  type CompiledWorld,
  compileWorld,
  type Expr,
  walk,
} from "@alltp/engine";
import {
  BOSS_FACTS,
  compileTricks,
  DERIVED_FACTS,
  erWorld,
  MEDALLION_FACTS,
  mandatoryConnections,
  TRICK_ITEMS,
  toState,
  UNKNOWN_FACT_OF,
} from "@alltp/pack-alttpr";
import { drWorld, KEY_ITEMS } from "@alltp/pack-alttpr/door-world";
import { describe, expect, it } from "vitest";
import { items, itemsMax } from "@/games/alttpr/data/items";
import {
  type DungeonItems,
  HIDEABLE,
  type RunSettings,
} from "@/games/alttpr/data/presets";
import { drSettingsOf, packSettings } from "@/games/alttpr/logic/settings";
import { fillerOf, trackerInput } from "@/games/alttpr/logic/solution";

/**
 * What no cell reaches, and why that is right. Anything else the rules read
 * beyond the board is a bug of this spec's kind.
 */
const EXCEPTIONS: Readonly<Record<string, string>> = {
  // Hyrule Castle's big key, which DR's key drops may shuffle: no cell
  // records it, so DR's world reads it as maybe (its `unrecorded`)
  "bigKeyH2>=1": "no cell; maybe in DR's world",
  // The silver bow: the board records it as the bow and its silver arrows,
  // which canShootArrows2 reads beside it (`silverArrowUpgrade & bow`)
  "bow>=2": "covered by the bow and silver arrows",
  // The active flute: v31's pool holds none (config/item.php:34,
  // OcarinaActive 0); the flute found flies through canActivateOcarina
  "flute>=2": "not in the pool",
};

/** A run of every hidden setting in a world: the rules read both ways. */
const mystery = (
  mode: RunSettings["mode"],
  dungeonItems: DungeonItems,
): RunSettings => ({
  accessibility: "items",
  crystalsGanon: 7,
  crystalsTower: 7,
  dungeonItems,
  entranceShuffle: "none",
  goal: "ganon",
  hidden: HIDEABLE,
  itemFunctionality: "normal",
  itemPlacement: "advanced",
  itemPool: "normal",
  mode,
  swordless: false,
});

/** Every cell at its top, every prize given, the Bomb Merchant checked. */
const fullBoard = (run: RunSettings) => {
  const values: Record<string, number | boolean> = {};
  for (const id of Object.keys(items)) {
    values[id] = typeof items[id] === "boolean" ? true : itemsMax[id];
  }
  // The Pendant of Courage, two pendants, five crystals, the red two
  [1, 2, 2, 3, 3, 3, 3, 3, 4, 4].forEach((reward, index) => {
    values[`reward${index}`] = reward;
  });
  const settings = packSettings(run);
  return toState(
    trackerInput({
      checked: { "bomb-merchant": true },
      items: values as never,
      medallions: [],
      settings: run,
      smallKeys: Array(13).fill(9),
    }),
    settings,
  );
};

/** What the state holds beside the items, set by the app or the pack. */
const FACTS = new Set([
  ...MEDALLION_FACTS,
  // Each slot's boss under boss shuffle: toState holds its Unknown fact
  ...BOSS_FACTS,
  ...DERIVED_FACTS,
  ...TRICK_ITEMS,
  ...new Set(UNKNOWN_FACT_OF.values()),
]);

type Read = { readonly atom: string; readonly min: number };

/** Whether `arg` is the `fact & maybe` that pairs an atom of `name`. */
const isFactBranch = (arg: Expr, name: string) => {
  const fact = UNKNOWN_FACT_OF.get(name);
  return (
    arg.type === "and" &&
    arg.args.some((a) => a.type === "item" && a.name === fact) &&
    arg.args.some((a) => a.type === "const" && a.value === "maybe")
  );
};

/**
 * Every item atom a world reads, through the helpers it calls, and those of
 * a count the board may not know that no `fact & maybe` sits beside.
 */
const atomsOf = (world: CompiledWorld) => {
  const read = new Map<string, Read>();
  const bare = new Set<string>();
  const paired = new WeakSet<Expr>();
  const helpers = new Set<string>();
  const visit = (expr: Expr) =>
    walk(expr, (node) => {
      // walk visits a node before its arguments: mark the paired ones
      if (node.type === "or") {
        for (const arg of node.args) {
          const names =
            arg.type === "item"
              ? [arg.name]
              : arg.type === "count"
                ? arg.names
                : [];
          if (
            names.some((name) =>
              node.args.some((other) => isFactBranch(other, name)),
            )
          ) {
            paired.add(arg);
          }
        }
      }
      if (node.type === "item" || node.type === "count") {
        const min = node.min as number;
        const names = node.type === "item" ? [node.name] : node.names;
        const atom = node.type === "item" ? node.name : `count(${names})`;
        read.set(`${atom}>=${min}`, { atom, min });
        if (
          names.some((name) => UNKNOWN_FACT_OF.has(name)) &&
          !paired.has(node)
        ) {
          bare.add(`${atom}>=${min}`);
        }
      }
      if (node.type === "helper" && !helpers.has(node.name)) {
        helpers.add(node.name);
        const body = world.rules.helpers.get(node.name);
        if (body !== undefined) visit(body);
      }
    });
  for (const expr of [...world.locationExprs, ...world.exitExprs]) {
    visit(expr);
  }
  return { bare, read };
};

/**
 * The atoms a world reads that the board can never satisfy: above what its
 * cells reach at their top, neither a fact, a small key, nor an exception.
 * @param full - The state of a board with every cell at its top
 * @param facts - The world's own facts, which its solver gives
 */
const neverOf = (
  world: CompiledWorld,
  full: Readonly<Record<string, unknown>>,
  facts: readonly string[] = [],
): string[] => {
  const known = new Set([...FACTS, ...facts]);
  const never: string[] = [];
  for (const [key, { atom, min }] of atomsOf(world).read) {
    // Small keys: the key model holds them, or with wild keys the cells
    if (known.has(atom) || /^key[A-Z]\d$/.test(atom)) continue;
    const names = atom.startsWith("count(")
      ? atom
          .slice(6, -1)
          .split(",")
          .flatMap((name) => world.rules.groups.get(name) ?? [name])
      : [atom];
    // A count no cell records (the escape's bombs) is read as maybe while
    // unknown, which the pairing below holds
    if (names.every((name) => UNKNOWN_FACT_OF.has(name) && !(name in full))) {
      continue;
    }
    const held = names.reduce((sum, name) => sum + Number(full[name] ?? 0), 0);
    if (held < min && EXCEPTIONS[key] === undefined) never.push(key);
  }
  return never;
};

/** A Door Randomizer run of a world: every setting known (doorLogic). */
const doorRun = (
  mode: RunSettings["mode"],
  dungeonItems: DungeonItems,
): RunSettings => {
  const { hidden: _hidden, ...run } = mystery(mode, dungeonItems);
  return { ...run, dropShuffle: "keys", pottery: "keys", randomizer: "dr" };
};

/**
 * The worlds the app compiles: vt's and its tricks', the entrance shuffle's,
 * the Door Randomizer's.
 */
const WORLDS = (["open", "standard", "inverted"] as const).flatMap((mode) =>
  (["standard", "full"] as const).flatMap((dungeonItems) => {
    const run = mystery(mode, dungeonItems);
    const settings = packSettings(run);
    const worlds: [string, CompiledWorld, readonly string[]][] = [
      [`${mode} ${dungeonItems}`, fillerOf(settings).world, []],
      [`${mode} ${dungeonItems} tricks`, compileTricks(settings), []],
    ];
    if (mode !== "inverted" && dungeonItems === "full") {
      const er = erWorld(settings, mandatoryConnections());
      worlds.push([
        `${mode} crossed`,
        er.compiled,
        er.facts.map(({ item }) => item),
      ]);
    }
    const full = fullBoard(run);
    const door = doorRun(mode, dungeonItems);
    const dr = drWorld(drSettingsOf(door), { unrecorded: ["bigKeyH2"] });
    return [
      ...worlds.map(([name, world, facts]) => ({ facts, full, name, world })),
      {
        facts: dr.facts.flatMap(({ item, maybe }) => [item, maybe ?? item]),
        // Every dungeon's keys, as DR's world reads the recorded ones
        full: {
          ...fullBoard(door),
          ...Object.fromEntries(
            KEY_ITEMS.filter((item) => item.startsWith("key")).map((item) => [
              item,
              9,
            ]),
          ),
        },
        name: `${mode} ${dungeonItems} door`,
        world: dr.compiled,
      },
    ];
  }),
);

describe("the atoms the rules read", () => {
  it.each(WORLDS)(
    "are all ones the board can satisfy: $name",
    ({ facts, full, world }) => {
      expect(neverOf(world, full, facts)).toEqual([]);
    },
  );

  it.each(WORLDS)(
    "read a count the board may not know as maybe while unknown: $name",
    ({ world }) => {
      expect([...atomsOf(world).bare]).toEqual([]);
    },
  );

  it("would catch hearts no cell records, and a count read bare", () => {
    const open = WORLDS.find(({ name }) => name === "open standard");
    if (open === undefined) throw new Error("no Open world");
    // The board before the hearts cell: the basic placement's gate unmet
    const noHearts = { ...open.full, heartContainer: 0, pieceOfHeart: 0 };
    expect(neverOf(open.world, noHearts)).toContain("heartContainer>=7");
    const bare = compileWorld(
      {
        regions: [{ id: "start", locations: [{ id: "a", req: "tenBombs" }] }],
        start: "start",
      },
      undefined,
      { items: ["tenBombs"] },
    );
    expect([...atomsOf(bare).bare]).toEqual(["tenBombs>=1"]);
  });
});
