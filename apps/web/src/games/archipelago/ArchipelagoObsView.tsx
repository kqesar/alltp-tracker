import type { CSSProperties } from "react";
import { StreamTimer } from "@/components/ui/StreamTimer";
import type { StreamSize } from "@/components/ui/StreamTools";
import { FeedWords } from "@/games/archipelago/components/FeedLine";
import { SkinGrid } from "@/games/archipelago/components/SkinGrid";
import { kindOf } from "@/games/archipelago/project";
import {
  type ApFeedEntry,
  useArchipelagoStore,
} from "@/games/archipelago/store";
import { rowsOf } from "@/games/archipelago/worlds/skin";
import { skinFor } from "@/games/archipelago/worlds/skins";
import type { ObsViewProps } from "@/games/registry";
import { useObsStage } from "@/hooks/useObsStage";

/** The text list's width, in cells: a name and its count fit on a line. */
const LIST_COLUMNS = 8;

/** How many feed lines the stream view shows (`&feed=1`). */
export const STREAM_LINES = 5;

/** The rows under the grid the feed's lines take: 0.55 of a cell each. */
const FEED_ROWS = Math.ceil(STREAM_LINES * 0.55);

/** The progression items held, a line each: a world with no skin. */
const ProgressionList = () => {
  const items = useArchipelagoStore((state) => state.items);
  const held = items.filter((item) => kindOf(item.flags) === "progression");
  return (
    <ul className="board-grid ap-obs-list" data-testid="ap-obs-list">
      {held.map((item) => (
        <li className="ap-obs-list__item" key={item.name}>
          {item.name}
          {item.count > 1 && ` ×${item.count}`}
        </li>
      ))}
    </ul>
  );
};

/** The last lines involving the slot, never a hint, oldest first: a chat's order. */
export const streamLines = (feed: readonly ApFeedEntry[]): ApFeedEntry[] =>
  feed
    .filter((entry) => entry.mine && entry.kind !== "hint")
    .slice(-STREAM_LINES);

const StreamFeed = () => {
  const feed = useArchipelagoStore((state) => state.feed);
  const lines = streamLines(feed);
  return (
    <ol className="ap-obs-feed" data-testid="ap-obs-feed">
      {lines.map((entry) => (
        <li className="ap-obs-feed__line" key={entry.seq}>
          <FeedWords entry={entry} />
        </li>
      ))}
    </ol>
  );
};

/**
 * The Archipelago stream view (`?view=obs`): the skin's grid for a world that
 * has one, else the progression items held, a line each, on a transparent
 * page, following the board through storage. With `&feed=1` (off unless
 * asked), the last five lines of the feed involving the slot under it, never
 * a hint. With `&timer=1`, the run timer on a row of its own under the grid,
 * as every game's stream view draws it (the feed then under the timer). It
 * never connects, and shows nothing of where the room is: the run it reads
 * holds no address or password.
 */
export const ArchipelagoObsView = ({
  background,
  feed = false,
  relay,
  timer = false,
}: ObsViewProps) => {
  const skin = skinFor(useArchipelagoStore((state) => state.room?.game));
  const lines = useArchipelagoStore(
    (state) =>
      state.items.filter((item) => kindOf(item.flags) === "progression").length,
  );
  const columns = skin === null ? LIST_COLUMNS : skin.columns;
  const stageRef = useObsStage({
    columns,
    extraRows: (timer ? 1 : 0) + (feed ? FEED_ROWS : 0),
    rows: skin === null ? Math.max(lines, 1) : rowsOf(skin).length,
    view: relay === "follow" ? "follow" : "obs",
  });
  const style = {
    "--ap-feed-row": timer ? 1 : 0,
    "--obs-columns": columns,
    ...(background ? { backgroundColor: background } : {}),
  } as CSSProperties;

  return (
    <main
      className="obs-view"
      data-testid="obs-view"
      ref={stageRef}
      style={style}
    >
      {skin === null ? <ProgressionList /> : <SkinGrid skin={skin} />}
      {timer && <ApStreamTimer />}
      {feed && <StreamFeed />}
    </main>
  );
};

/** A cell's crisp size in a source, in pixels: four times the 16 px sprites. */
const NATIVE_CELL = 64;

/**
 * The browser source's size for this board's stream view, with or without
 * the timer's row and the feed's rows (the desktop app's Stream tools).
 * @param game - The slot's game: its skin's grid, or the list
 * @param lines - The list's lines, for a world without a skin
 */
export const streamSize =
  (game: string | undefined, lines: number) =>
  (timer: boolean, feed = false): StreamSize => {
    const skin = skinFor(game);
    const rows = skin === null ? Math.max(lines, 1) : rowsOf(skin).length;
    const columns = skin === null ? LIST_COLUMNS : skin.columns;
    return {
      height: (rows + (timer ? 1 : 0) + (feed ? FEED_ROWS : 0)) * NATIVE_CELL,
      width: columns * NATIVE_CELL,
    };
  };

/** The run's timer, drawn as every game's stream view draws it. */
const ApStreamTimer = () => (
  <StreamTimer timer={useArchipelagoStore((state) => state.timer)} />
);
