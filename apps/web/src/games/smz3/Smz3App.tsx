import { GameShell } from "@/components/ui/GameShell";
import { useSmz3Autotrack } from "@/games/smz3/components/Smz3Autotrack";
import { Smz3Controls } from "@/games/smz3/components/Smz3Controls";
import { Smz3Grid } from "@/games/smz3/components/Smz3Grid";
import { Smz3Keycards } from "@/games/smz3/components/Smz3Keycards";
import { Smz3Maps } from "@/games/smz3/components/Smz3Maps";
import { Smz3Tokens } from "@/games/smz3/components/Smz3Tokens";
import { useSmz3Store } from "@/games/smz3/store";
import { useUndoShortcuts } from "@/games/useUndoShortcuts";

/**
 * The SMZ3 tracker: both games' items and the rewards found (and under
 * keysanity, the keys and keycards), beside the maps of Hyrule and Zebes,
 * the pack's logic colouring every location. Its actions show as icons once
 * their labels no longer fit on one row: it has no More menu, so the label
 * fold is the one it takes.
 */
const Smz3App = () => {
  useUndoShortcuts(useSmz3Store);
  useSmz3Autotrack();
  const keysanity = useSmz3Store((state) => state.settings.keysanity);
  return (
    <GameShell game="smz3" toolbar={<Smz3Controls />}>
      <div
        className="smz3-layout"
        data-keys={keysanity || undefined}
        data-testid="layout"
      >
        <div className="smz3-board">
          <Smz3Grid />
          <Smz3Tokens />
          {keysanity && <Smz3Keycards />}
        </div>
        <Smz3Maps />
      </div>
    </GameShell>
  );
};

export default Smz3App;
