// Every named rule of the pack, as the engine loads them: the item helpers,
// the bosses and the boss each dungeon fights, and the item groups.
import type { RulesSource } from "@alltp/engine";
import { BOSS_SLOTS, BOSSES } from "./bosses";
import { GROUPS, HELPERS, type Rule } from "./helpers";

/** Each named rule with its upstream source, for tools and tests. */
export const NAMED_RULES: Readonly<Record<string, Rule>> = {
  ...HELPERS,
  ...BOSSES,
  ...BOSS_SLOTS,
};

/** What `loadRules` takes: `loadRules(RULES)`. */
export const RULES: RulesSource = {
  groups: GROUPS,
  helpers: Object.fromEntries(
    Object.entries(NAMED_RULES).map(([name, { req }]) => [name, req]),
  ),
};
