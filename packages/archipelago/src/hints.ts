// Hints and the players' status, as the server's data storage holds them:
// `_read_hints_{team}_{slot}` (every hint involving the slot, as finder or
// receiver) and `_read_client_status_{team}_{slot}` (where each player's game
// stands). The session reads both after Connected and watches them
// (SetNotify), so a change arrives as a SetReply. Values come from AP 0.6.8's
// NetUtils.py (HintStatus, ClientStatus).

/** AP 0.6's hint statuses (NetUtils.HintStatus). */
export const HINT_STATUS = {
  avoid: 20,
  found: 40,
  noPriority: 10,
  priority: 30,
  unspecified: 0,
} as const;

/** A hint's status, as the board names it. */
export type HintStatusName =
  | "found"
  | "priority"
  | "unspecified"
  | "no-priority"
  | "avoid";

/** One hint: an item for `receiver`, at `location` in `finder`'s world. */
export interface Hint {
  readonly receiver: number;
  readonly finder: number;
  /** The location's id, in the finder's game. */
  readonly location: number;
  /** The item's id, in the receiver's game. */
  readonly item: number;
  readonly found: boolean;
  /** The entrance leading there, in entrance-shuffled worlds; "" otherwise. */
  readonly entrance: string;
  /** AP's classification bits of the item. */
  readonly flags: number;
  /** HINT_STATUS's number; one this version does not know reads unspecified. */
  readonly status: number;
}

/** AP 0.6's client statuses (NetUtils.ClientStatus). */
export const CLIENT_STATUS = {
  connected: 5,
  goal: 30,
  playing: 20,
  ready: 10,
  unknown: 0,
} as const;

export type ClientStatusName = keyof typeof CLIENT_STATUS;

export const hintsKey = (team: number, slot: number): string =>
  `_read_hints_${team}_${slot}`;

export const clientStatusKey = (team: number, slot: number): string =>
  `_read_client_status_${team}_${slot}`;

const CLIENT_STATUS_KEY = /^_read_client_status_(\d+)_(\d+)$/;

/** The team and slot a client status key names, or null. */
export function parseClientStatusKey(
  key: string,
): { readonly team: number; readonly slot: number } | null {
  const match = CLIENT_STATUS_KEY.exec(key);
  return match === null
    ? null
    : { slot: Number(match[2]), team: Number(match[1]) };
}

const isInt = (value: unknown): value is number => Number.isInteger(value);

/** The data storage value of a hints key; null when it is not a list of hints. */
export function parseHints(value: unknown): Hint[] | null {
  if (!Array.isArray(value)) return null;
  const hints: Hint[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) return null;
    const record = entry as Record<string, unknown>;
    const {
      entrance,
      finding_player: finder,
      found,
      item,
      item_flags: flags,
      location,
      receiving_player: receiver,
      status,
    } = record;
    if (
      !isInt(receiver) ||
      !isInt(finder) ||
      !isInt(location) ||
      !isInt(item) ||
      typeof found !== "boolean"
    ) {
      return null;
    }
    hints.push({
      entrance: typeof entrance === "string" ? entrance : "",
      finder,
      flags: isInt(flags) ? flags : 0,
      found,
      item,
      location,
      receiver,
      // Before 0.6 a hint had no status: found or not said it all
      status: isInt(status)
        ? status
        : found
          ? HINT_STATUS.found
          : HINT_STATUS.unspecified,
    });
  }
  return hints;
}

/** A hint's status by name; `found` wins over whatever status it carries. */
export function hintStatus(
  hint: Pick<Hint, "found" | "status">,
): HintStatusName {
  if (hint.found || hint.status === HINT_STATUS.found) return "found";
  switch (hint.status) {
    case HINT_STATUS.priority:
      return "priority";
    case HINT_STATUS.noPriority:
      return "no-priority";
    case HINT_STATUS.avoid:
      return "avoid";
    default:
      return "unspecified";
  }
}

/** Most wanted first: the order a list of hints is read in. */
const RANK: Readonly<Record<HintStatusName, number>> = {
  avoid: 3,
  found: 4,
  "no-priority": 2,
  priority: 0,
  unspecified: 1,
};

/**
 * The slot's hints in two lists: the items it will receive (wherever they
 * are, its own world included), and the items others will receive that sit
 * in its world. Each list most wanted first, found last.
 */
export function splitHints(
  hints: readonly Hint[],
  slot: number,
): { readonly forMe: Hint[]; readonly inMyWorld: Hint[] } {
  const byRank = (a: Hint, b: Hint) =>
    RANK[hintStatus(a)] - RANK[hintStatus(b)];
  return {
    forMe: hints.filter((hint) => hint.receiver === slot).sort(byRank),
    inMyWorld: hints
      .filter((hint) => hint.finder === slot && hint.receiver !== slot)
      .sort(byRank),
  };
}

/**
 * What a hint costs the slot in points, as MultiServer works it out
 * (`get_hint_cost`): `hint_cost` is a percentage of the slot's locations,
 * at least 1 when not 0. Null while the room's cost is unknown.
 */
export function hintCost(
  percent: number | null,
  locations: number,
): number | null {
  if (percent === null) return null;
  if (percent === 0) return 0;
  return Math.max(1, Math.floor(percent * 0.01 * locations));
}

/** A client status number by name; one this version does not know is unknown. */
export function clientStatusName(status: number): ClientStatusName {
  for (const [name, value] of Object.entries(CLIENT_STATUS)) {
    if (value === status) return name as ClientStatusName;
  }
  return "unknown";
}
