// The pack as the tracker runs it: the world of a run's settings, compiled
// once, then solved on every change of the items.
import {
  type CompiledWorld,
  compileWorld,
  loadRules,
  type Rules,
  type State,
  type World,
} from "@alltp/engine";
import { DERIVED_FACTS, derivedFacts } from "./derived";
import { HELPERS } from "./helpers";
import { ITEM_IDS, KEYCARDS } from "./items";
import {
  MEDALLION_FACTS,
  MEDALLION_HELPERS,
  medallionFacts,
  type PadKnowledge,
} from "./medallions";
import { REGION_MODULES } from "./regions";
import { engineSettings, type Smz3Settings } from "./settings";
import { type BuildOptions, buildWorld, pick, type Rule } from "./world";

/**
 * Every name a requirement may read from the state: the items, the
 * medallion facts and the facts derived from the items. Anything that
 * compiles a world of this pack takes its item list from here.
 */
export const STATE_NAMES: readonly string[] = [
  ...ITEM_IDS,
  ...MEDALLION_FACTS,
  ...DERIVED_FACTS,
];

/** The helpers of a logic: the shared ones and every region's own. */
export function rules(hard: boolean): Rules {
  const all: Readonly<Record<string, Rule>> = {
    ...HELPERS,
    ...MEDALLION_HELPERS,
    ...Object.assign({}, ...REGION_MODULES.map((m) => m.helpers ?? {})),
  };
  const helpers: Record<string, string> = {};
  for (const [name, rule] of Object.entries(all)) {
    helpers[name] = pick(rule, hard);
  }
  return loadRules({ helpers });
}

/** The engine's graph of a run's world. */
export function world(
  settings: Smz3Settings,
  options: Omit<BuildOptions, "hard"> = {},
): World {
  return buildWorld(REGION_MODULES, {
    ...options,
    hard: settings.smLogic === "hard",
  });
}

/** How a world is compiled beyond the run's settings. */
export interface CompileOptions extends Omit<BuildOptions, "hard"> {
  /** Placements known, by setting; every one unknown when left out. */
  readonly placed?: ReadonlySet<string>;
  /** False for a world whose bosses hold no reward (the logic tests). */
  readonly rewardsPlaced?: boolean;
}

/**
 * The run's world, compiled with its settings and checked against the
 * state's names: about a millisecond, once per run or settings change.
 * Throws a DefinitionError if the pack does not hold together.
 */
export function compile(
  settings: Smz3Settings,
  { placed, rewardsPlaced, ...build }: CompileOptions = {},
): CompiledWorld {
  return compileWorld(
    world(settings, build),
    rules(settings.smLogic === "hard"),
    {
      items: STATE_NAMES,
      settings: engineSettings(settings, {
        ...(placed === undefined ? {} : { placed }),
        ...(rewardsPlaced === undefined ? {} : { rewardsPlaced }),
      }),
    },
  );
}

/**
 * The state a world is solved against: the items held (every keycard
 * without keysanity), what the player knows of the medallion pads, and the
 * facts derived from the items.
 */
export function toState(
  items: Readonly<Record<string, number>>,
  pads: PadKnowledge,
  { keysanity }: Pick<Smz3Settings, "keysanity">,
): State {
  const held = keysanity ? items : { ...items, ...ALL_KEYCARDS };
  return { ...held, ...medallionFacts(pads), ...derivedFacts(held) };
}

const ALL_KEYCARDS = Object.fromEntries(KEYCARDS.map((card) => [card, 1]));
