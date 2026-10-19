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
  const found = BOSS_TOKENS.filter(({ id }) => (items[id] ?? 0) > 0).length;
  return (
    <section
      aria-labelledby="smz3-tokens-heading"
      className="smz3-tokens"
      data-testid="smz3-tokens"
    >
      <h2 className="smz3-tokens__heading" id="smz3-tokens-heading">
        Boss tokens
      </h2>
      <p
        aria-live="polite"
        className="smz3-tokens__summary"
        data-testid="smz3-tokens-summary"
      >
        {found >= needed
          ? `${found} found: Tourian is open.`
          : `${found} of the ${needed} Tourian asks for.`}
      </p>
      <ul className="smz3-tokens__list">
        {BOSS_TOKENS.map(({ id, name }) => {
          const held = (items[id] ?? 0) > 0;
          return (
            <li key={id}>
              <button
                aria-pressed={held}
                className="smz3-token"
                data-testid={`smz3-${id}`}
                onClick={() => step(id, held ? -1 : 1)}
                type="button"
              >
                <span aria-hidden="true" className="smz3-token__check">
                  {held ? "✓" : ""}
                </span>
                {name}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
