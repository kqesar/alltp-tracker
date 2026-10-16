import { type Expr, IDENTIFIER, isIdentifier, walk } from "./ast";
import { ParseError, parse } from "./parser";

/**
 * Game data that does not hold together: a requirement that does not parse,
 * a reference to an unknown helper, item or region, a helper cycle, a
 * duplicate id. Thrown when rules or worlds are loaded, never while solving.
 * A parse failure keeps its ParseError as `cause`.
 */
export class DefinitionError extends Error {
  override readonly name = "DefinitionError";
}

/** Rules as a game pack writes them. */
export interface RulesSource {
  /**
   * Named requirements, used as `@name`. Helpers may use other helpers, but
   * not in a cycle.
   */
  readonly helpers?: Readonly<Record<string, string>>;
  /**
   * Named sets of items, usable inside `count(...)` only: `count(crystal)`
   * sums the values of every item in the `crystal` group. Groups do not nest.
   */
  readonly groups?: Readonly<Record<string, readonly string[]>>;
}

/** Loaded rules: helpers parsed and checked, group members de-duplicated. */
export interface Rules {
  readonly helpers: ReadonlyMap<string, Expr>;
  readonly groups: ReadonlyMap<string, readonly string[]>;
}

export const NO_RULES: Rules = { groups: new Map(), helpers: new Map() };

/**
 * Parses and checks a helper/group table. Throws a DefinitionError for an
 * invalid name, an empty or nested group, a helper that does not parse, a
 * reference to an unknown helper, a group used outside `count()`, or a cycle
 * between helpers (the message spells the cycle out: `@a -> @b -> @a`).
 */
export function loadRules(source: RulesSource = {}): Rules {
  const groups = new Map<string, readonly string[]>();
  for (const [name, members] of Object.entries(source.groups ?? {})) {
    if (!isIdentifier(name)) {
      throw new DefinitionError(`Group "${name}" is not a valid name`);
    }
    if (members.length === 0) {
      throw new DefinitionError(`Group "${name}" is empty`);
    }
    for (const member of members) {
      if (!isIdentifier(member)) {
        throw new DefinitionError(
          `Group "${name}" has an invalid member "${member}"`,
        );
      }
    }
    groups.set(name, [...new Set(members)]);
  }
  for (const [name, members] of groups) {
    for (const member of members) {
      if (groups.has(member)) {
        throw new DefinitionError(
          `Group "${name}" contains the group "${member}": groups do not nest`,
        );
      }
    }
  }

  const helpers = new Map<string, Expr>();
  for (const [name, text] of Object.entries(source.helpers ?? {})) {
    if (!IDENTIFIER.test(name)) {
      throw new DefinitionError(`Helper "@${name}" is not a valid name`);
    }
    helpers.set(name, parseIn(text, `Helper "@${name}"`));
  }

  const rules: Rules = { groups, helpers };
  for (const [name, expr] of helpers) {
    checkReferences(expr, rules, `Helper "@${name}"`);
  }
  checkHelperCycles(helpers);
  return rules;
}

/** Parses `text`, turning a ParseError into a DefinitionError saying where. */
export function parseIn(text: string, where: string): Expr {
  try {
    return parse(text);
  } catch (error) {
    if (error instanceof ParseError) {
      throw new DefinitionError(`${where}: ${error.message}`, {
        cause: error,
      });
    }
    throw error;
  }
}

/**
 * Checks what `expr` refers to: helpers must exist, a group may only appear
 * inside `count()`, and with `items` given every item must be one of them.
 */
export function checkReferences(
  expr: Expr,
  rules: Rules,
  where: string,
  items?: ReadonlySet<string>,
): void {
  const checkItem = (name: string) => {
    if (items !== undefined && !items.has(name)) {
      throw new DefinitionError(`${where} uses unknown item "${name}"`);
    }
  };
  walk(expr, (node) => {
    switch (node.type) {
      case "helper":
        if (!rules.helpers.has(node.name)) {
          throw new DefinitionError(
            `${where} uses unknown helper "@${node.name}"`,
          );
        }
        break;
      case "item":
        if (rules.groups.has(node.name)) {
          throw new DefinitionError(
            `${where} uses the group "${node.name}" outside count()`,
          );
        }
        checkItem(node.name);
        break;
      case "count":
        for (const name of node.names) {
          if (!rules.groups.has(name)) checkItem(name);
        }
        break;
      default:
        break;
    }
  });
}

/** The distinct items `count(names)` sums, groups expanded. */
export function countedItems(
  names: readonly string[],
  groups: ReadonlyMap<string, readonly string[]>,
): string[] {
  const items = new Set<string>();
  for (const name of names) {
    const members = groups.get(name);
    if (members === undefined) items.add(name);
    else for (const member of members) items.add(member);
  }
  return [...items];
}

/** Depth-first search with an explicit path, so a cycle can be named. */
function checkHelperCycles(helpers: ReadonlyMap<string, Expr>): void {
  const done = new Set<string>();
  const path: string[] = [];

  const visit = (name: string): void => {
    if (done.has(name)) return;
    const start = path.indexOf(name);
    if (start !== -1) {
      const cycle = [...path.slice(start), name].map((h) => `@${h}`);
      throw new DefinitionError(`Helpers form a cycle: ${cycle.join(" -> ")}`);
    }
    const expr = helpers.get(name);
    if (expr === undefined) return;
    path.push(name);
    walk(expr, (node) => {
      if (node.type === "helper") visit(node.name);
    });
    path.pop();
    done.add(name);
  };

  for (const name of helpers.keys()) visit(name);
}
