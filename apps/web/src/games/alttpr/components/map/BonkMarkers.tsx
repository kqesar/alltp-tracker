import type { CSSProperties } from "react";
import {
  type BonkPlace,
  bonkPlaceStateOf,
  bonkPlacesOf,
} from "@/games/alttpr/logic/doorChecks";
import { capitalized, useLogicWords } from "@/games/alttpr/logic/words";
import { useReviewHeld } from "@/games/alttpr/review/labels";
import { useGameStore } from "@/games/alttpr/stores/gameStore";
import type { World } from "@/games/alttpr/utils";
import { getAssetPath } from "@/games/alttpr/utils";
import { useTooltip } from "@/hooks/useTooltip";

/**
 * A place of the Overworld Randomizer's bonk drops: a tree, a rock pile or
 * a statue, or several sharing it. Clicking it checks them all, or none
 * once all are. Its tooltip names them and their state, and in a review
 * what they held, as a chest's does.
 */
const BonkMarker = ({ place }: { place: BonkPlace }) => {
  const state = useGameStore((store) => bonkPlaceStateOf(place, store));
  const { states } = useLogicWords();
  const toggleChecks = useGameStore((store) => store.toggleChecks);
  const names = place.locations.map((location) => location.name).join(", ");
  const count = place.locations.length;
  const reviewed = useReviewHeld();
  const held = place.locations
    .flatMap((location) => {
      const found = reviewed.get(location.id);
      return found === undefined ? [] : [found.name];
    })
    .join(", ");
  const title = `Bonk drop${count > 1 ? `s (${count})` : ""}: ${names}`;
  const tooltip = useTooltip({
    kind: "text",
    text: `${capitalized(states[state])}${held === "" ? "" : `. Held: ${held}`}`,
    title,
  });
  const style: CSSProperties & Record<"--x" | "--y", string> = {
    "--x": `${place.x}%`,
    "--y": `${place.y}%`,
    backgroundImage: `url(${getAssetPath("poi.png")})`,
  };
  return (
    <button
      {...tooltip}
      aria-label={`${title}: ${states[state]}${held === "" ? "" : `. Held: ${held}`}`}
      aria-pressed={state === "opened"}
      className={`mapspan chest bonk state-glyph ${state}`}
      data-testid={`marker-${place.id}`}
      onClick={() =>
        toggleChecks(place.locations.map((location) => location.id))
      }
      style={style}
      type="button"
    />
  );
};

/**
 * A world's bonk drops in an Overworld Randomizer run that shuffles them,
 * once their data is loaded (hooks/useBonkDrops.ts): none otherwise.
 */
export const BonkMarkers = ({ world }: { world: World }) => {
  const places = useGameStore((store) => bonkPlacesOf(store.settings));
  return places
    .filter((place) => place.world === world)
    .map((place) => <BonkMarker key={place.id} place={place} />);
};
