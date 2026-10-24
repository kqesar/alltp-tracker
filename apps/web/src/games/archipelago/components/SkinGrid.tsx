import type { CSSProperties } from "react";
import { useArchipelagoStore } from "@/games/archipelago/store";
import {
  countsOf,
  rowsOf,
  type Skin,
  type SkinCell,
} from "@/games/archipelago/worlds/skin";

/** An ALttPR asset's address. */
const asset = (file: string) => `${import.meta.env.BASE_URL}assets/${file}`;

type Count = (name: string) => number;

/** An item's cell: its sprite, greyed until received, its count on it. */
const ItemCell = ({
  cell,
  count,
}: {
  cell: Extract<SkinCell, { kind: "item" }>;
  count: Count;
}) => {
  const level = cell.level(count);
  const held = cell.names.reduce((sum, name) => sum + count(name), 0);
  // A count only where the sprite does not draw it and there is more than one
  const shown = !cell.leveled && held > 1 && cell.names.length === 1;
  return (
    <li
      className={`grid-item-base ap-cell${level === 0 && !cell.always ? " griditem--dimmed" : ""}`}
      data-testid={`ap-item-${cell.id}`}
      style={
        { "--sprite": `url(${asset(cell.sprite(level))})` } as CSSProperties
      }
    >
      <span className="sr-only">
        {cell.name}, {cell.describe(level)}
        {shown && `, ${held}`}
      </span>
      {shown && (
        <span aria-hidden="true" className="board-cell__count">
          {held}
        </span>
      )}
    </li>
  );
};

/** A dungeon's keys: its short name, the big key, the small keys counted. */
const KeysCell = ({
  cell,
  count,
}: {
  cell: Extract<SkinCell, { kind: "keys" }>;
  count: Count;
}) => {
  const big = count(cell.big) > 0;
  const small = count(cell.small);
  return (
    <li
      className="grid-item-base bigkey-container"
      data-testid={`ap-item-${cell.id}`}
    >
      <span className="sr-only">
        {cell.dungeon}: big key {big ? "received" : "not received"},{" "}
        {small === 1 ? "1 small key" : `${small} small keys`}
      </span>
      <div aria-hidden="true" className="bigkey-grid">
        <div className="bigkey-quadrant key-label">{cell.short}</div>
        <div className="bigkey-quadrant">
          <span
            className={`ap-key${big ? "" : " griditem--dimmed"}`}
            style={{ backgroundImage: `url(${asset("bigkey.png")})` }}
          />
        </div>
        <div className="bigkey-quadrant">
          <span
            className={`ap-key${small > 0 ? "" : " griditem--dimmed"}`}
            style={{ backgroundImage: `url(${asset("smallkey.png")})` }}
          />
        </div>
        <div className="bigkey-quadrant bigkey-count">{small}</div>
      </div>
    </li>
  );
};

/**
 * A world's items drawn with the tracker's art, as its skin lays them: a
 * list of cells, each saying its item and level in words. Nothing to click:
 * the board is the server's.
 */
export const SkinGrid = ({ skin }: { skin: Skin }) => {
  const items = useArchipelagoStore((state) => state.items);
  const count = countsOf(items);
  return (
    <div className="board-grid ap-skin" data-testid="ap-skin">
      <ul
        aria-label={`${skin.game} items`}
        className="board-grid__cells ap-skin__cells"
        style={{ "--columns": skin.columns } as CSSProperties}
      >
        {rowsOf(skin).flatMap((row, rowIndex) =>
          row.map((cell, colIndex) =>
            cell === null ? (
              <li
                aria-hidden="true"
                className="grid-item-base"
                // biome-ignore lint/suspicious/noArrayIndexKey: a fixed place in the grid
                key={`${rowIndex}-${colIndex}`}
              />
            ) : cell.kind === "item" ? (
              <ItemCell cell={cell} count={count} key={cell.id} />
            ) : (
              <KeysCell cell={cell} count={count} key={cell.id} />
            ),
          ),
        )}
      </ul>
    </div>
  );
};
