import { CRYSTALS, prizesHeld } from "@/games/alttpr/data/items";
import { useGameStore } from "@/games/alttpr/stores/gameStore";
import { getAssetPath } from "@/games/alttpr/utils";

/**
 * The pendants Link holds, as the pause menu shows them: the green one on
 * top, the blue and the red under it, each greyed until held (`prizesHeld`:
 * the beaten bosses' prizes the player marked, or what autotracking read).
 * It only shows: the prizes are marked on the dungeons' cells. The blue and
 * the red count together, as the game's rules do (a pendant held).
 */
export const PendantsCell = () => {
  const held = useGameStore((state) => {
    const { green, pendants } = prizesHeld(state.items);
    return `${green > 0 ? 1 : 0}${pendants > 0 ? 1 : 0}${pendants > 1 ? 1 : 0}`;
  });
  const count = [...held].filter((bit) => bit === "1").length;

  return (
    <div
      aria-label={`Pendants held: ${count} of 3`}
      className="grid-item-base prize-cell prize-cell--pendants"
      data-testid="prize-pendants"
      role="img"
    >
      {[0, 1, 2].map((index) => (
        <span
          aria-hidden="true"
          className={`prize-cell__pendant${held[index] === "1" ? "" : " griditem--dimmed"}`}
          key={index}
          style={{
            backgroundImage: `url(${getAssetPath(`pendant${index}.png`)})`,
          }}
        />
      ))}
    </div>
  );
};

/**
 * The crystals Link holds, out of seven: the crystal, greyed while none is
 * held, and the count under it, green at seven (`prizesHeld`). It only
 * shows, beside what Ganon's Tower and Ganon ask for.
 */
export const CrystalsCell = () => {
  const crystals = useGameStore((state) => prizesHeld(state.items).crystals);

  return (
    <div
      aria-label={`Crystals held: ${crystals} of ${CRYSTALS}`}
      className="grid-item-base prize-cell prize-cell--crystals"
      data-testid="prize-crystals"
      role="img"
    >
      <span
        aria-hidden="true"
        className={`prize-cell__crystal${crystals > 0 ? "" : " griditem--dimmed"}`}
        style={{ backgroundImage: `url(${getAssetPath("crystal0.png")})` }}
      />
      <span
        aria-hidden="true"
        className={`cell-count prize-cell__count${crystals >= CRYSTALS ? " cell-count--most" : ""}`}
      >
        {crystals}/{CRYSTALS}
      </span>
    </div>
  );
};
