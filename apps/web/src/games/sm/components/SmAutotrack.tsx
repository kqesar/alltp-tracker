import {
  GameAutotrackControl,
  useGameAutotrack,
} from "@/components/autotrack/GameAutotrackControl";
import { lazyDialog } from "@/components/autotrack/lazyDialog";
import { smAutotrack } from "@/games/sm/autotrack/store";

/** Autotracking's lifetime in the Super Metroid tracker (useGameAutotrack). */
export const useSmAutotrack = () => useGameAutotrack(smAutotrack);

const dialog = lazyDialog(() =>
  import("@/games/sm/components/SmAutotrackDialog").then(
    (module) => module.SmAutotrackDialog,
  ),
);

/** The toolbar's Autotracking button, opening Super Metroid's dialog. */
export const SmAutotrack = () => (
  <GameAutotrackControl dialog={dialog} session={smAutotrack} />
);
