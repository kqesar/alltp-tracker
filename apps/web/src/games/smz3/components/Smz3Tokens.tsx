import { ToggleList } from "@/components/ui/ToggleList";
import { BOSS_TOKENS } from "@/games/smz3/data";
import { useSmz3Store } from "@/games/smz3/store";

/**
 * Super Metroid's boss tokens found, each a toggle, and how many Tourian
 * still wants: a run's bosses hold them, Zelda's as well as Zebes's.
 */
export const Smz3Tokens = () => {
  const items = useSmz3Store((state) => state.items);
  const needed = useSmz3Store((state) => state.settings.tourianBosses);
  const step = useSmz3Store((state) => state.step);
  const tokens = BOSS_TOKENS.map(({ id, name }) => ({
    id,
    name,
    on: (items[id] ?? 0) > 0,
    testId: `smz3-${id}`,
  }));
  const found = tokens.filter(({ on }) => on).length;
  return (
    <ToggleList
      className="smz3-tokens"
      items={tokens}
      onToggle={({ id, on }) => step(id, on ? -1 : 1)}
      summary={
        found >= needed
          ? `${found} found: Tourian is open.`
          : `${found} of the ${needed} Tourian asks for.`
      }
      testId="smz3-tokens"
      title="Boss tokens"
    />
  );
};
