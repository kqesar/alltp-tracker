// The Web Lock one tab of the tracker holds while it autotracks, whatever its
// game: two tabs never both read the console and lay it on a run. Each game's
// autotracking store takes it as it connects and lets it go as it stops.

/** The lock's name, across every game and tab of the tracker. */
export const AUTOTRACK_LOCK = "alltp-tracker-autotrack";

export type AutotrackLock = {
  /**
   * Take the lock: at once when no other tab holds it, else when that tab
   * lets it go (it closes, or disconnects), telling `waiting` meanwhile. A
   * browser without Web Locks goes ahead, as before them.
   * @param isCurrent - Whether the connect taking it is still wanted
   * @param waiting - Told true while another tab holds it, false once not
   * @returns Whether it holds the lock; false once no longer wanted
   */
  take: (
    isCurrent: () => boolean,
    waiting: (elsewhere: boolean) => void,
  ) => Promise<boolean>;
  /** Stop waiting for the lock, and let it go if held. */
  release: () => void;
};

/**
 * A lock for one autotracking store.
 * @param lockManager - The browser's lock manager, read at each take (none
 * without Web Locks)
 */
export const createAutotrackLock = (
  lockManager: () => LockManager | undefined = () =>
    (navigator as { locks?: LockManager }).locks,
): AutotrackLock => {
  /** Lets the lock go, while this store holds it. */
  let releaseLock: (() => void) | null = null;
  /** Stops waiting for the lock, while this store waits. */
  let stopWaiting: AbortController | null = null;

  return {
    release: () => {
      stopWaiting?.abort();
      stopWaiting = null;
      releaseLock?.();
      releaseLock = null;
    },
    take: async (isCurrent, waiting) => {
      const locks = lockManager();
      if (locks === undefined) return true;
      const request = (options: LockOptions) =>
        new Promise<boolean>((resolve) => {
          locks
            .request(AUTOTRACK_LOCK, options, (lock) => {
              // Not free, or no longer wanted: let it go at once
              if (lock === null || !isCurrent()) {
                resolve(false);
                return;
              }
              resolve(true);
              return new Promise<void>((release) => {
                releaseLock = release;
              });
            })
            .catch(() => resolve(false));
        });
      if (await request({ ifAvailable: true })) return true;
      if (!isCurrent()) return false;
      waiting(true);
      stopWaiting = new AbortController();
      const held = await request({ signal: stopWaiting.signal });
      if (isCurrent()) waiting(false);
      return held;
    },
  };
};
