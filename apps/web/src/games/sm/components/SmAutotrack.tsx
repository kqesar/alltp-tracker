import {
  GameAutotrackControl,
  useGameAutotrack,
} from "@/components/autotrack/GameAutotrackControl";
import { lazyAutotrackDialog } from "@/components/autotrack/lazyAutotrackDialog";
import { smAutotrack } from "@/games/sm/autotrack/store";

/** Autotracking's lifetime in the Super Metroid tracker (useGameAutotrack). */
export const useSmAutotrack = () => useGameAutotrack(smAutotrack);

const dialog = lazyAutotrackDialog(() =>
  import("@/games/sm/components/SmAutotrackDialog").then(
    (module) => module.SmAutotrackDialog,
  ),
);

/** The toolbar's Autotracking button, opening Super Metroid's dialog. */
export const SmAutotrack = () => (
  <GameAutotrackControl dialog={dialog} session={smAutotrack} />
);
