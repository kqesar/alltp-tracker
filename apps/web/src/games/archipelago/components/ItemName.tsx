import { itemLabel } from "@/games/archipelago/itemLabel";

/**
 * An item's name in words, AP's own name as its title (and accessible
 * description) where the two differ, so the exact name stays one hover away.
 * @param game - The item's world
 */
export const ItemName = ({
  className,
  game,
  name,
}: {
  className: string;
  game: string | undefined;
  name: string;
}) => {
  const label = itemLabel(game, name);
  return (
    <span className={className} title={label === name ? undefined : name}>
      {label}
    </span>
  );
};
