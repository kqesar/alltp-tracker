// A run replaced while a session is connected: New game, Import, a shared
// link, a new run type. A follower lays only what changed in the game since
// its last reading, so a board replaced under it would never get the values
// the game still holds (the sword in the save, the hearts): the game's store
// says the board was replaced, and its autotracking store tells the follower
// to lay everything again, as at a first connect.

type Listener = (game: string) => void;

const listeners = new Set<Listener>();

/**
 * A game's board was replaced by another run, not changed: its autotracking,
 * if connected, lays what the game holds on the new board at once. The game's
 * store calls it after the replacement is set.
 */
export const requestResync = (game: string) => {
  for (const listener of listeners) listener(game);
};

/** Call `listener` with the game's id whenever its board was replaced. */
export const onResync = (listener: Listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const recountListeners = new Set<Listener>();

/**
 * A game's run kept its progress but changed settings that move what its
 * counters hold (a Door Randomizer location setting, the dungeon items): its
 * autotracking, if connected, counts them again from what the game holds. The
 * game's store calls it after the change is set.
 */
export const requestRecount = (game: string) => {
  for (const listener of recountListeners) listener(game);
};

/** Call `listener` with the game's id whenever its settings changed mid-run. */
export const onRecount = (listener: Listener) => {
  recountListeners.add(listener);
  return () => recountListeners.delete(listener);
};
