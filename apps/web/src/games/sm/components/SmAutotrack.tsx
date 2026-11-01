import { romSeedOf } from "@/autotrack/romSeed";
import {
  GameAutotrackControl,
  useGameAutotrack,
} from "@/components/autotrack/GameAutotrackControl";
import { lazyAutotrackDialog } from "@/components/autotrack/lazyAutotrackDialog";
import { smRomSeedCheck } from "@/games/sm/autotrack/romSeed";
import { smAutotrack } from "@/games/sm/autotrack/store";
import { useSmStore } from "@/games/sm/store";

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

/** The board's notice and the dialog's line of a ROM of another seed. */
export const smRomSeed = romSeedOf({
  check: smRomSeedCheck,
  game: "sm",
  session: smAutotrack,
  store: useSmStore,
});
