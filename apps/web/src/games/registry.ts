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
};

/** A game, as the shell runs it. */
export type GameModule = {
  /** Start what the game runs once per page, before it renders. */
  start: () => void;
  /** The tracker. */
  App: ComponentType;
  /** The stream view (`?view=obs`). */
  ObsView: ComponentType<ObsViewProps>;
};

export const GAME_IDS = ["alttpr"] as const;
export type GameId = (typeof GAME_IDS)[number];

const LOADERS: Readonly<Record<GameId, () => Promise<GameModule>>> = {
  alttpr: () => import("@/games/alttpr/module").then(({ alttpr }) => alttpr),
};

/** Where this device keeps the game it tracks. */
export const ACTIVE_GAME_KEY = "alltp-tracker-game";

const isGameId = (value: unknown): value is GameId =>
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

/** Load a game's module. */
export const loadGame = (id: GameId): Promise<GameModule> => LOADERS[id]();
