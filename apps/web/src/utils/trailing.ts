/**
 * A trailing throttle: a `poke` starts a wait of `delay` ms, those during it
 * ride along, and `run` fires once when it ends, so the last change always
 * goes out and a burst costs one run. Shared by what the desktop app
 * publishes after each change to the run (`follow/publish.ts`,
 * `overlay/publish.ts`).
 * @param delay - The longest wait between a change and its run, in ms
 * @param run - What to do when the wait ends
 * @returns `poke`, which starts the wait unless one is under way, and
 * `cancel`, which drops it
 */
export const trailing = (
  delay: number,
  run: () => void,
): { cancel: () => void; poke: () => void } => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cancel = () => {
    clearTimeout(timer);
    timer = undefined;
  };
  return {
    cancel,
    poke: () => {
      timer ??= setTimeout(() => {
        timer = undefined;
        run();
      }, delay);
    },
  };
};
