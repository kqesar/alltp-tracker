// The desktop app's side of live follow: after each change to the run, the
// run as the game's store saved it goes to the relay, which hands it to every
// device following (docs/desktop.md, "Live follow on the LAN").

import type { RaceFeed } from "@/follow/raceRun";
import type { GameId, RunStore } from "@/games/registry";
import { trailing } from "@/utils/trailing";

/** The run, as the relay takes it (`follow_publish`). */
export type Publication = {
  game: GameId;
  key: string;
  value: string;
  sentAt: number;
};

/** The longest wait between a change and its publication, in ms. */
export const PUBLISH_DELAY_MS = 250;

/**
 * Publish the run now, then after each change, at most once per
 * `PUBLISH_DELAY_MS`: a change starts the wait, those during it ride along,
 * and the run is read from storage when it ends, so the last state always
 * goes out. A burst (autotracking's sync, an undo held down) costs one
 * publication. The saved run is read rather than the state, because it is
 * what the following device's store reads, validated and migrated by the
 * same code; and only once the wait ends, since the store saves after it
 * tells its subscribers. A run unchanged since the last one is not sent again.
 * @param send - Hands the run to the relay
 * @param read - Reads the saved run; the page's storage by default
 * @param race - The game's Race Mode and whitelist: while Race Mode is on,
 * the run goes cut to it (`follow/raceRun.ts`), and it goes again when Race
 * Mode comes or goes
 * @returns `stop`, which ends publishing, and `now`, which publishes at once
 * even an unchanged run (a device just joined: it gets a fresh `sentAt`)
 */
export const publishRun = ({
  game,
  race,
  read = (key) => localStorage.getItem(key),
  send,
  store,
}: {
  game: GameId;
  store: RunStore;
  send: (publication: Publication) => void;
  read?: (key: string) => string | null;
  race?: RaceFeed;
}): { now: () => void; stop: () => void } => {
  const key = store.persist.getOptions().name ?? "";
  let last: string | null = null;

  const publish = (always: boolean) => {
    wait.cancel();
    let value: string | null;
    try {
      value = read(key);
      // A run never changed was never saved: save it as it stands
      if (value === null) {
        store.setState({});
        value = read(key);
      }
    } catch {
      return;
    }
    // In Race Mode, the whitelist alone; a run it cannot read is not sent
    if (value !== null && race?.source.isOn()) value = race.run(value);
    if (value === null || (!always && value === last)) return;
    last = value;
    send({ game, key, sentAt: Date.now(), value });
  };

  const wait = trailing(PUBLISH_DELAY_MS, () => publish(false));
  const unsubscribe = store.subscribe(wait.poke);
  const stopRace = race?.source.subscribe(wait.poke);
  publish(true);

  return {
    now: () => publish(true),
    stop: () => {
      unsubscribe();
      stopRace?.();
      wait.cancel();
    },
  };
};
