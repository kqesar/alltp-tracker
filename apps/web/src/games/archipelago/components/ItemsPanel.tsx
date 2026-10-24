import { useId } from "react";
import { ItemList } from "@/games/archipelago/components/ItemList";
import { SkinGrid } from "@/games/archipelago/components/SkinGrid";
import { useArchipelagoStore } from "@/games/archipelago/store";
import { mappedNames } from "@/games/archipelago/worlds/skin";
import { skinFor } from "@/games/archipelago/worlds/skins";

/**
 * The items the slot received: a world with a skin as its grid, then what
 * the grid has no cell for under "More items"; any other world as the list.
 */
export const ItemsPanel = () => {
  const items = useArchipelagoStore((state) => state.items);
  const game = useArchipelagoStore((state) => state.room?.game);
  const id = useId();
  const skin = skinFor(game);
  const mapped = skin === null ? null : mappedNames(skin);
  return (
    <section aria-labelledby={id} className="ap-panel" data-testid="ap-items">
      <h2 className="ap-panel__heading" id={id}>
        Items
      </h2>
      {skin === null ? (
        <ItemList heading="Received" items={items} />
      ) : (
        <>
          <SkinGrid skin={skin} />
          <ItemList
            heading="More items"
            items={items.filter((item) => !mapped?.has(item.name))}
          />
        </>
      )}
    </section>
  );
};
