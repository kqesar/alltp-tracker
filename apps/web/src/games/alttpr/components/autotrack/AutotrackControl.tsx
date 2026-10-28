import { useState } from "react";
import { isRaceHeldByMemory } from "@/autotrack/raceMode";
import { headlineOf, phaseOf } from "@/autotrack/status";
import { lazyAutotrackDialog } from "@/components/autotrack/lazyAutotrackDialog";
import {
  RaceBadge,
  RememberedRaceBadge,
  raceBadgeText,
  StatusDot,
} from "@/components/autotrack/StatusDot";
import { PlugIcon } from "@/components/ui/ToolbarIcons";
import { ToolbarMenuItem } from "@/components/ui/ToolbarMenu";
import { useAutotrackStore } from "@/games/alttpr/stores/autotrackStore";

const dialog = lazyAutotrackDialog(() =>
  import("@/games/alttpr/components/autotrack/AutotrackDialog").then(
    (module) => module.AutotrackDialog,
  ),
);

/** Fetch the autotracking dialog's code, once (see `lazyDialog`). */
export const preloadAutotrackDialog = dialog.preload;

/** The status as the toolbar shows it: the dot's phase, its words, the race. */
const useAutotrackSummary = () => {
  const active = useAutotrackStore((state) => state.active);
  const elsewhere = useAutotrackStore((state) => state.elsewhere);
  const shown = useAutotrackStore((state) => state.shown);
  const unavailable = useAutotrackStore((state) => state.unavailable);
  const remembered = useAutotrackStore(isRaceHeldByMemory);
  return {
    headline: unavailable
      ? "Could not load: reload the page"
      : headlineOf(shown, active, elsewhere),
    phase: unavailable
      ? ("problem" as const)
      : phaseOf(shown, active, elsewhere),
    race:
      active && !elsewhere && shown.code === "connected" && shown.race.active
        ? shown.race
        : null,
    remembered,
  };
};

/**
 * The toolbar's Autotracking control: a plug with the status dot, which
 * opens the autotracking dialog (setup, connection, what was read). Its name
 * says the status; the race-legal badge shows while Race Mode is on. The
 * dialog never opens by itself: connecting, losing the bridge and
 * reconnecting change the dot and the live region only.
 * @param variant - A toolbar button, or an item of the toolbar's More menu
 */
export const AutotrackControl = ({
  variant = "toolbar",
}: {
  variant?: "toolbar" | "menu";
}) => {
  const { headline, phase, race, remembered } = useAutotrackSummary();
  // Race Mode held by the memory alone has a badge too: the gates keep to it
  const memory = race === null && remembered;
  const { open, shown } = dialog.useDialog();
  const icon = (
    <span className="autotrack-icon">
      <PlugIcon />
      <StatusDot phase={phase} />
    </span>
  );

  return (
    <>
      {variant === "menu" ? (
        <ToolbarMenuItem
          {...dialog.handlers}
          detail={
            race === null
              ? `${headline}${memory ? ", Race Mode" : ""}`
              : `${headline}, race-legal${race.setting === "on" ? ", always on" : ""}`
          }
          icon={icon}
          label="Autotracking"
          onSelect={open}
          testId="toolbar-more-autotrack"
        />
      ) : (
        <button
          {...dialog.handlers}
          // Its words and badge are flex items, which browsers name with
          // spaces between them: one name, the visible text first, in the
          // order it shows, then the status the dot stands for
          aria-label={`Autotracking${race ? ` ${raceBadgeText(race)}` : memory ? " Race Mode" : ""}, ${headline}`}
          className="tracker-controls__button autotrack-button"
          data-phase={phase}
          data-testid="autotrack-button"
          onClick={open}
          title={`Autotracking: ${headline}`}
          type="button"
        >
          {icon}
          <span className="toolbar-label">Autotracking</span>
          {race && (
            <>
              {" "}
              <RaceBadge race={race} />
            </>
          )}
          {memory && (
            <>
              {" "}
              <RememberedRaceBadge />
            </>
          )}
        </button>
      )}
      {shown}
    </>
  );
};

/**
 * The More button's copy of the status dot, for a bar so narrow that the
 * control folds into the menu (toolbar-menu.css shows it then only), so the
 * status stays in view during the run. A screen reader hears the status from
 * the live region and from the menu's Autotracking item instead.
 */
export const AutotrackMoreBadge = () => {
  const { phase } = useAutotrackSummary();
  return (
    <span
      aria-hidden="true"
      className="toolbar-more__badge"
      data-testid="toolbar-more-badge"
    >
      <StatusDot phase={phase} />
    </span>
  );
};

/**
 * Says the status to screen readers as it changes, politely: never while it
 * only passes through connecting or attaching, so a run is not narrated, but
 * when it connects, fails, needs the browser's prompt answered, waits for
 * another tab, or stops. What autotracking did of its own (a switch to the
 * seed's run type) follows the status it came with, and the next one.
 * Outside the control, so a folded control still speaks.
 */
export const AutotrackLiveRegion = () => {
  const { headline, phase } = useAutotrackSummary();
  const shown = useAutotrackStore((state) => state.shown);
  const elsewhere = useAutotrackStore((state) => state.elsewhere);
  const [said, setSaid] = useState("");
  const quiet =
    !elsewhere &&
    (shown.code === "idle" ||
      (phase === "busy" && shown.code !== "local-network-prompt"));
  const news = useAutotrackStore((state) => state.news);
  const message = quiet ? said : `Autotracking: ${headline}`;
  if (message !== said) setSaid(message);

  return (
    <span className="sr-only" data-testid="autotrack-live" role="status">
      {[message, news?.text].filter(Boolean).join(". ")}
    </span>
  );
};
