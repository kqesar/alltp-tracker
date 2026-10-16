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
 * Why Race Mode is on, for the badge's tooltip and the dialog: the seed's
 * race flag says so, or it could not be read and Race Mode stays on to be
 * safe (the session fails closed).
 */
export const raceReason = (race: RaceStatus) =>
  race.flag === "race"
    ? "This is a race seed: the tracker reads only what races permit."
    : "The race flag could not be read, so the tracker reads only what races permit.";

/**
 * The race-legal badge: shown while Race Mode is on, from the seed's race
 * flag or because the flag could not be read. Every read is then one the
 * official race-legal autotracker specification permits.
 */
export const RaceBadge = ({ race }: { race: RaceStatus }) => (
  <span
    className="race-badge"
    data-testid="race-badge"
    title={raceReason(race)}
  >
    Race-legal
  </span>
);
