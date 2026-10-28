// What Race Mode takes from a run's file and link. Both carry the places the
// player checked and when (a link: the `checked` bits and the timeline's
// `check:` stamps), which Race Mode already keeps from the overlay API and
// from live follow. In doubt, they are off in a race: the toolbars read
// `isRaceModeOrPending` (`autotrack/raceMode.ts`).

import { SHARE_HELP } from "@/share/shareRun";
import { isDesktopApp } from "@/utils/platform";

/** Said by the Export and Share buttons while they are off. */
export const RACE_SHARE_WHY =
  "Off while Race Mode is on or not yet known to be off: a file or a link would hold the places you checked and when. It is back once Race Mode is off.";

/** The Share button's help in the desktop app during a race: live follow only. */
export const RACE_SHARE_LIVE_HELP =
  "Follow this run live on this network. A link to the run is off while Race Mode is on or not yet known to be off.";

/** What the Share dialog says, in place of a link, during a race. */
export const RACE_SHARE_NOTE =
  "No link to the run is made while Race Mode is on or not yet known to be off: it would hold the places you checked and when.";

/**
 * What the Export and Share buttons are while Race Mode is on or not yet known
 * to be off, for both toolbars: the reason each is off, or null while it
 * works. The desktop app keeps Share in a race, since live follow's switch is
 * in its dialog, which then offers no link.
 */
export const raceShareGate = (race: boolean) => ({
  exportOff: race ? RACE_SHARE_WHY : null,
  shareOff: race && !isDesktopApp ? RACE_SHARE_WHY : null,
  shareTitle: race ? RACE_SHARE_LIVE_HELP : SHARE_HELP,
});
