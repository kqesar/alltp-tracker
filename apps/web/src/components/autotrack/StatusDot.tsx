import type { RaceStatus } from "@alltp/autotrack";
import type { Phase } from "@/autotrack/status";

/**
 * The autotracking status dot. Each phase has its own shape besides its
 * colour: off a hollow ring, busy a half-filled disc, on a filled disc, a
 * problem a triangle. Decorative: the control it sits in says the status.
 */
export const StatusDot = ({
  large = false,
  phase,
}: {
  large?: boolean;
  phase: Phase;
}) => (
  <span
    aria-hidden="true"
    className={large ? "autotrack-dot autotrack-dot--large" : "autotrack-dot"}
    data-phase={phase}
    data-testid="autotrack-dot"
  />
);

/**
 * Why Race Mode is on, for the badge's tooltip and the dialog: the player
 * set it always on, the seed's race flag says so, or the flag could not be
 * read and Race Mode stays on to be safe (the session fails closed).
 */
export const raceReason = (race: RaceStatus) => {
  if (race.setting === "on") {
    return "Race Mode is always on, as you set it: the tracker reads only what races permit.";
  }
  return race.flag === "race"
    ? "This is a race seed: the tracker reads only what races permit."
    : "The race flag could not be read, so the tracker reads only what races permit.";
};

/**
 * The race-legal badge: shown while Race Mode is on, because the player set
 * it always on, from the seed's race flag, or because the flag could not be
 * read. Race Mode then reads nothing the race profile forbids (stricter than
 * the ALTTPR Auto-tracker Rules v2.0 ask, `packages/autotrack/README.md`).
 * Set always on, it says so in a second part: "Race-legal | Always on".
 */
export const RaceBadge = ({ race }: { race: RaceStatus }) => (
  <span
    className="race-badge"
    data-testid="race-badge"
    title={raceReason(race)}
  >
    Race-legal
    {race.setting === "on" && (
      <>
        {" "}
        <span className="race-badge__forced" data-testid="race-badge-forced">
          Always on
        </span>
      </>
    )}
  </span>
);

/** The race-legal badge's words, for a name that holds it. */
export const raceBadgeText = (race: RaceStatus) =>
  race.setting === "on" ? "Race-legal Always on" : "Race-legal";
