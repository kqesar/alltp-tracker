// The games the tracker tracks, each a module of its own: its board, its
// stream view and everything they run on (store, logic, autotracking), a chunk
// the page loads only for the game this device tracks. The shell (main.tsx)
// asks for that one; a player of one game never downloads another's.

import type { ComponentType } from "react";

/** What the stream view takes from its address (`utils/view.ts`). */
export type ObsViewProps = {
  /** A solid background, already validated by `obsBackground`; none when null */
  background: string | null;
  /** Whether to draw the run timer under the grid (`&timer=1`) */
  timer?: boolean;
  /**
   * Set when the run comes from the desktop app's relay, not from this
   * page's storage: no keyboard shortcut changes it. `"follow"` is a device
   * following the run live (`?view=follow`), on an opaque page under the
   * view's banner; `"obs"` is the stream view the app serves to OBS
   * (`?view=obs&token=…`), on a transparent page like the site's.
   */
  relay?: "follow" | "obs";
};

/**
 * A game's persisted store, as far as the shell needs it: the desktop app
 * publishes the saved run after each change, and a device following it
 * writes the run it receives under the store's key, then reloads the store
 * from it (`follow/`), as another tab's change is followed.
 */
export interface RunStore {
  subscribe: (listener: () => void) => () => void;
  /** With nothing to change, only saves the run as it stands */
  setState: (nothing: Record<string, never>) => void;
  persist: {
    getOptions: () => { name?: string };
    rehydrate: () => Promise<void> | void;
  };
}

/**
 * A save read and checked by a game's own import, not yet applied: `load`
 * replaces the run with it, as Import does once the player confirms.
 */
export type RunImport =
  | { ok: true; load: () => void }
  | { ok: false; reason: string };

/** A game, as the shell runs it. */
export type GameModule = {
  /** Start what the game runs once per page, before it renders. */
  start: () => void;
  /** Read an export, as a file or a shared link brings it: untrusted text. */
  importRun: (save: string) => RunImport;
  /** The tracker. */
  App: ComponentType;
  /** The stream view (`?view=obs`), and the followed view's grid. */
  ObsView: ComponentType<ObsViewProps>;
  /** The run's store. */
  store: RunStore;
};

export const GAME_IDS = ["alttpr", "sm", "smz3", "archipelago"] as const;
export type GameId = (typeof GAME_IDS)[number];

/** Each game's name, and the randomizer the tracker follows for it. */
export const GAMES: Readonly<
  Record<GameId, { readonly name: string; readonly randomizer: string }>
> = {
  alttpr: { name: "A Link to the Past", randomizer: "alttpr.com" },
  archipelago: { name: "Archipelago", randomizer: "archipelago.gg" },
  sm: { name: "Super Metroid", randomizer: "Map Rando" },
  smz3: { name: "SMZ3", randomizer: "samus.link" },
};

/**
 * What players and search engines call the tracker. A display name only: the
 * repository, the URL, the storage keys and the desktop app's identifier keep
 * the original `alltp-tracker`, which people's saved runs and installs rest on.
 */
export const PRODUCT_NAME = "Rando Atlas";

const LOADERS: Readonly<Record<GameId, () => Promise<GameModule>>> = {
  alttpr: () => import("@/games/alttpr/module").then(({ alttpr }) => alttpr),
  archipelago: () =>
    import("@/games/archipelago/module").then(({ archipelago }) => archipelago),
  sm: () => import("@/games/sm/module").then(({ sm }) => sm),
  smz3: () => import("@/games/smz3/module").then(({ smz3 }) => smz3),
};

/** The page's title for a game: the product's name, then the game's. */
export const pageTitle = (id: GameId): string =>
  `${PRODUCT_NAME} \u00b7 ${GAMES[id].name} Randomizer`;

/** Where this device keeps the game it tracks. */
export const ACTIVE_GAME_KEY = "alltp-tracker-game";

export const isGameId = (value: unknown): value is GameId =>
  (GAME_IDS as readonly unknown[]).includes(value);

/**
 * The game this device tracks: the one it saved, else A Link to the Past,
 * the tracker's first. Storage that throws (a private window, blocked site
 * data) or holds anything else means the first too.
 */
export const activeGame = (storage?: Pick<Storage, "getItem">): GameId => {
  try {
    const saved = (storage ?? localStorage).getItem(ACTIVE_GAME_KEY);
    return isGameId(saved) ? saved : "alttpr";
  } catch {
    return "alttpr";
  }
};

/**
 * Save the game this device tracks, read by `activeGame` from the next load.
 * Storage that refuses leaves the page on the game it had.
 */
export const saveActiveGame = (id: GameId): void => {
  try {
    localStorage.setItem(ACTIVE_GAME_KEY, id);
  } catch {
    // Storage refused: the page tracks the game it would have
  }
};

/**
 * Takes the game a link asks for (`?game=sm`: the button of the game pages
 * search engines index, a link someone shares) as this device's, saved as a
 * switch is, then drops the parameter from the address so a reload or a
 * bookmark does not ask again. Anything but a game's id is dropped unread.
 */
export const takeGameFromAddress = (): void => {
  const address = new URL(window.location.href);
  const asked = address.searchParams.get("game");
  if (asked === null) return;
  address.searchParams.delete("game");
  window.history.replaceState(
    window.history.state,
    "",
    `${address.pathname}${address.search}${address.hash}`,
  );
  if (isGameId(asked)) saveActiveGame(asked);
};

/** Load a game's module. */
export const loadGame = (id: GameId): Promise<GameModule> => LOADERS[id]();

/**
 * Track another game on this device: saved, then the page loads again with
 * that game's module alone. Each game keeps its own run, so coming back
 * finds it as it was.
 */
export const switchGame = (
  id: GameId,
  reload: () => void = () => window.location.reload(),
): void => {
  saveActiveGame(id);
  reload();
};
