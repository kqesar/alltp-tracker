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
 * a hint. It never connects, and shows nothing of where the room is: the run
 * it reads holds no address or password.
 */
export const ArchipelagoObsView = ({
  background,
  feed = false,
  relay,
}: ObsViewProps) => {
  const skin = skinFor(useArchipelagoStore((state) => state.room?.game));
  const lines = useArchipelagoStore(
    (state) =>
      state.items.filter((item) => kindOf(item.flags) === "progression").length,
  );
  const stageRef = useObsStage({
    columns: skin === null ? LIST_COLUMNS : skin.columns,
    extraRows: feed ? FEED_ROWS : 0,
    rows: skin === null ? Math.max(lines, 1) : rowsOf(skin).length,
    view: relay === "follow" ? "follow" : "obs",
  });

  return (
    <main
      className="obs-view"
      data-testid="obs-view"
      ref={stageRef}
      style={background ? { backgroundColor: background } : undefined}
    >
      {skin === null ? <ProgressionList /> : <SkinGrid skin={skin} />}
      {feed && <StreamFeed />}
    </main>
  );
};
