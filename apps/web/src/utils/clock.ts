/**
 * The clock the run timer is drawn with: this device's, moved by an offset
 * when the run comes from another computer whose clock differs (a viewer
 * following the desktop app on the local network, `follow/`). A timer counts
 * from an instant the player's computer stamped, so it is read against that
 * computer's time, not the viewer's.
 */
let offsetMs = 0;

/** Now, on the clock of the computer the run comes from. */
export const clockNow = (): number => Date.now() + offsetMs;

/**
 * How far the run's computer's clock is ahead of this device's, in ms: 0 for
 * a run tracked here.
 */
export const setClockOffset = (ms: number): void => {
  offsetMs = ms;
};
