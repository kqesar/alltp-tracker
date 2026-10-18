import type { Tri } from "@alltp/engine";
import { useId } from "react";
import { WaysList } from "@/components/ui/Missing";
import { isHidden } from "@/data/presets";
import { useGoModeMissing } from "@/hooks/useRunAnalysis";
import { goModeStatusOf } from "@/logic/missing";
import { useGameStore } from "@/stores/gameStore";
import { placeUnder } from "@/utils/popover";

/** Each state's glyph and words, after "Go mode". */
const STATES: Record<Tri, { glyph: string; words: string }> = {
  maybe: { glyph: "★?", words: "possible" },
  no: { glyph: "☆", words: "not yet" },
  yes: { glyph: "★", words: "in logic" },
};

/** What the go mode is missing, or that every step is in logic. */
const GoModeDetail = ({ tri }: { tri: Tri }) => {
  const missing = useGoModeMissing();
  if (tri === "yes") {
    return <p className="missing">Every step to the goal is in logic.</p>;
  }
  if (missing === undefined) {
    return <p className="missing missing--pending">Working it out…</p>;
  }
  return (
    <p className="missing">
      <span className="missing__lead">In logic with:</span>{" "}
      <WaysList ways={missing} />
    </p>
  );
};

/**
 * The run's go mode: whether every step to the run's goal is in logic
 * (★), possible (★?) or not yet (☆), in words beside the glyph; a screen
 * reader hears a change as it comes. A click shows what is missing.
 * Nothing for a goal without a go mode (all dungeons, triforce hunt); a
 * Mystery run's goal not known yet says so, until the player sets it.
 */
export const GoMode = () => {
  const tri = useGameStore((state) => goModeStatusOf(state)?.tri);
  const goalHidden = useGameStore((state) => isHidden(state.settings, "goal"));
  const panelId = useId();
  if (goalHidden) {
    return (
      <span className="go-mode go-mode--unknown" data-testid="go-mode">
        <span aria-hidden="true" className="go-mode__glyph">
          ?
        </span>
        Go mode: goal unknown
      </span>
    );
  }
  if (tri === undefined) return null;
  const { glyph, words } = STATES[tri];

  return (
    <>
      <button
        className={`go-mode go-mode--${tri}`}
        data-testid="go-mode"
        onClick={(event) => placeUnder(event, panelId)}
        popoverTarget={panelId}
        title="What go mode is missing"
        type="button"
      >
        <span aria-hidden="true" className="go-mode__glyph">
          {glyph}
        </span>
        Go mode: {words}
      </button>
      <div
        className="go-mode-panel"
        data-testid="go-mode-panel"
        id={panelId}
        popover="auto"
      >
        <GoModeDetail tri={tri} />
      </div>
      <span className="sr-only" data-testid="go-mode-status" role="status">
        Go mode: {words}
      </span>
    </>
  );
};
