import { useId } from "react";
import { ItemName } from "@/games/archipelago/components/ItemName";
import { ITEM_KINDS, kindOf } from "@/games/archipelago/project";
import type { ApItem } from "@/games/archipelago/store";

/**
 * Items as a list grouped by AP's classification (progression, useful,
 * filler, traps), each by name with how many: any world's items, from the
 * names its own data gives. Each group says its kind in words, never by
 * colour alone.
 * @param items - The items to list, in the order they came
 * @param heading - The list's heading
 * @param game - Their world, which says how its names read (itemLabel.ts)
 */
export const ItemList = ({
  game,
  heading,
  items,
}: {
  game: string | undefined;
  heading: string;
  items: readonly ApItem[];
}) => {
  const id = useId();
  const groups = ITEM_KINDS.map((kind) => ({
    ...kind,
    items: items.filter((item) => kindOf(item.flags) === kind.id),
  })).filter((group) => group.items.length > 0);
  return (
    <section
      aria-labelledby={id}
      className="ap-items"
      data-testid="ap-item-list"
    >
      <h3 className="ap-panel__subheading" id={id}>
        {heading}
      </h3>
      {groups.length === 0 ? (
        <p className="ap-panel__empty">None received yet.</p>
      ) : (
        groups.map((group) => (
          <div className="ap-items__group" key={group.id}>
            <h4 className="ap-items__kind" data-kind={group.id}>
              {group.name}{" "}
              <span className="ap-items__count">({group.items.length})</span>
            </h4>
            <ul className="ap-items__list">
              {group.items.map((item) => (
                <li
                  className="ap-items__item"
                  data-testid="ap-list-item"
                  key={item.name}
                >
                  <ItemName
                    className="ap-items__name"
                    game={game}
                    name={item.name}
                  />
                  {item.count > 1 && (
                    <span className="ap-items__times">
                      <span aria-hidden="true">×</span>
                      <span className="sr-only">, </span>
                      {item.count}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  );
};
