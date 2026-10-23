import {
  GameAutotrackControl,
  useGameAutotrack,
} from "@/components/autotrack/GameAutotrackControl";
import { lazyAutotrackDialog } from "@/components/autotrack/lazyAutotrackDialog";
import { smz3Autotrack } from "@/games/smz3/autotrack/store";

/** Autotracking's lifetime in the SMZ3 tracker (useGameAutotrack). */
export const useSmz3Autotrack = () => useGameAutotrack(smz3Autotrack);

const dialog = lazyAutotrackDialog(() =>
  import("@/games/smz3/components/Smz3AutotrackDialog").then(
    (module) => module.Smz3AutotrackDialog,
  ),
);

/** The toolbar's Autotracking button, opening SMZ3's dialog. */
export const Smz3Autotrack = () => (
  <GameAutotrackControl dialog={dialog} session={smz3Autotrack} />
);
