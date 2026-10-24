// The Web Locks one tab of the tracker holds while it talks to something
// outside the page, so two tabs never both do. Autotracking takes one, whatever
// the game: two tabs never both read the console and lay it on a run. The
// Archipelago board takes its own: one connection to the room per browser.

/** The autotracking lock's name, across every game and tab of the tracker. */
export const AUTOTRACK_LOCK = "alltp-tracker-autotrack";

export type TabLock = {
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

/** The autotracking lock, as its stores know it. */
export type AutotrackLock = TabLock;

/** The browser's lock manager, none without Web Locks. */
const browserLocks = () => (navigator as { locks?: LockManager }).locks;

/**
 * A lock one tab holds at a time.
 * @param name - The Web Lock's name
 * @param lockManager - The browser's lock manager, read at each take (none
 * without Web Locks)
 */
export const createTabLock = (
  name: string,
  lockManager: () => LockManager | undefined = browserLocks,
): TabLock => {
  /** Lets the lock go, while this holder holds it. */
  let releaseLock: (() => void) | null = null;
  /** Stops waiting for the lock, while this holder waits. */
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
            .request(name, options, (lock) => {
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

/**
 * The lock for one autotracking store: `createTabLock` on the lock every
 * game's autotracking shares.
 * @param lockManager - The browser's lock manager, read at each take
 */
export const createAutotrackLock = (
  lockManager: () => LockManager | undefined = browserLocks,
): AutotrackLock => createTabLock(AUTOTRACK_LOCK, lockManager);
