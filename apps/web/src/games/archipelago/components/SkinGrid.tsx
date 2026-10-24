import type { CSSProperties } from "react";
import { useArchipelagoStore } from "@/games/archipelago/store";
import {
  countsOf,
  rowsOf,
  type Skin,
  type SkinCell,
  type SkinSprite,
} from "@/games/archipelago/worlds/skin";

/** An ALttPR asset's address. */
const asset = (file: string) => `${import.meta.env.BASE_URL}assets/${file}`;

type Count = (name: string) => number;

/** A sprite's class and style: an ALttPR asset, or a frame of the SM sheet. */
const spriteOf = (sprite: SkinSprite) =>
  typeof sprite === "string"
    ? {
        className: "ap-cell",
        style: { "--sprite": `url(${asset(sprite)})` } as CSSProperties,
      }
    : {
        className: "ap-cell ap-cell--sm",
        style: { "--frame": sprite.frame } as CSSProperties,
      };

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
  // A counter's count from one; another's only where the sprite does not draw
  // it and there is more than one of its single item
  const shown = cell.counter
    ? held > 0
    : !cell.leveled && held > 1 && cell.names.length === 1;
  const { className, style } = spriteOf(cell.sprite(level));
  return (
    <li
      className={`grid-item-base ${className}${level === 0 && !cell.always ? " griditem--dimmed" : ""}`}
      data-testid={`ap-item-${cell.id}`}
      style={style}
    >
      <span className="sr-only">
        {cell.name}, {cell.describe(level)}
        {shown && !cell.counter && `, ${held}`}
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
  const big = cell.big !== undefined && count(cell.big) > 0;
  const small = cell.small === undefined ? 0 : count(cell.small);
  return (
    <li
      className="grid-item-base bigkey-container"
      data-testid={`ap-item-${cell.id}`}
    >
      <span className="sr-only">
        {cell.dungeon}:{" "}
        {[
          cell.big !== undefined &&
            `big key ${big ? "received" : "not received"}`,
          cell.small !== undefined &&
            (small === 1 ? "1 small key" : `${small} small keys`),
        ]
          .filter(Boolean)
          .join(", ")}
      </span>
      <div aria-hidden="true" className="bigkey-grid">
        <div className="bigkey-quadrant key-label">{cell.short}</div>
        <div className="bigkey-quadrant">
          {cell.big !== undefined && (
            <span
              className={`ap-key${big ? "" : " griditem--dimmed"}`}
              style={{ backgroundImage: `url(${asset("bigkey.png")})` }}
            />
          )}
        </div>
        <div className="bigkey-quadrant">
          {cell.small !== undefined && (
            <span
              className={`ap-key${small > 0 ? "" : " griditem--dimmed"}`}
              style={{ backgroundImage: `url(${asset("smallkey.png")})` }}
            />
          )}
        </div>
        <div className="bigkey-quadrant bigkey-count">
          {cell.small !== undefined && small}
        </div>
      </div>
    </li>
  );
};

/**
 * An area's keycards, laid as a key cell: its short name top left, then a
 * quadrant per card, its level's mark, dimmed until held.
 */
const CardsCell = ({
  cell,
  count,
}: {
  cell: Extract<SkinCell, { kind: "cards" }>;
  count: Count;
}) => {
  const held = cell.cards.map((card) => count(card.name) > 0);
  return (
    <li
      className="grid-item-base bigkey-container"
      data-testid={`ap-item-${cell.id}`}
    >
      <span className="sr-only">
        {cell.area} keycards:{" "}
        {cell.cards
          .map(
            (card, index) =>
              `${card.level} ${held[index] ? "received" : "not received"}`,
          )
          .join(", ")}
      </span>
      <div aria-hidden="true" className="bigkey-grid">
        <div className="bigkey-quadrant key-label">{cell.short}</div>
        {cell.cards.map((card, index) => (
          <div
            className={`bigkey-quadrant ap-card${held[index] ? "" : " ap-card--missing"}`}
            key={card.name}
          >
            {card.mark}
          </div>
        ))}
        {cell.cards.length < 3 && <div className="bigkey-quadrant" />}
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
        {rowsOf(skin, count).flatMap((row) =>
          row.map((cell) =>
            cell.kind === "item" ? (
              <ItemCell cell={cell} count={count} key={cell.id} />
            ) : cell.kind === "keys" ? (
              <KeysCell cell={cell} count={count} key={cell.id} />
            ) : (
              <CardsCell cell={cell} count={count} key={cell.id} />
            ),
          ),
        )}
      </ul>
    </div>
  );
};
