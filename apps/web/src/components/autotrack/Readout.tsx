import { type ReactNode, useId } from "react";
import type { AutotrackReading } from "@/autotrack/reading";
import { describeReading } from "@/autotrack/readout";
import { wildItems } from "@/data/presets";
import { useAutotrackStore } from "@/stores/autotrackStore";
import { useGameStore } from "@/stores/gameStore";

/** One group of the readout: a heading and its entries, or why it has none. */
const Group = ({
  children,
  count,
  empty = "None",
  testId,
  title,
  wide = false,
}: {
  children: ReactNode;
  count: number;
  /** What an empty group says */
  empty?: string;
  testId: string;
  title: string;
  /** Across the whole panel */
  wide?: boolean;
}) => (
  <div
    className={wide ? "readout__group readout__group--wide" : "readout__group"}
    data-testid={testId}
  >
    <h4 className="readout__title">{title}</h4>
    {count > 0 ? children : <p className="readout__none">{empty}</p>}
  </div>
);

/** Entries as a wrapping list of chips. */
const Chips = ({ entries }: { entries: readonly string[] }) => (
  <ul className="readout__chips">
    {entries.map((entry) => (
      <li className="readout__chip" key={entry}>
        {entry}
      </li>
    ))}
  </ul>
);

const WHY = {
  "not-read": "not read yet",
  "race-mode": "not read in Race Mode",
} as const;

const UNREAD = {
  "not-read": "Not read yet",
  "race-mode": "Not read in Race Mode",
} as const;

/**
 * "What I read": the items, the checked locations and the run's progress as
 * the tracker decoded them from memory at the last change, for the player to
 * hold against their game, and what of it the board has no cell for.
 * @param reading - The last reading
 * @param live - Whether the session still reads; else the reading is the
 * last before it lost the game
 */
export const Readout = ({
  live,
  reading,
}: {
  live: boolean;
  reading: AutotrackReading;
}) => {
  const titleId = useId();
  const wildKeys = useGameStore((state) => wildItems(state.settings).keys);
  const readout = describeReading(reading, wildKeys);
  // What the ROM does not state comes from the seed's file once it is in:
  // all of a race seed's settings but its logic
  const fileIn = useAutotrackStore(
    (state) =>
      state.seedFile?.hash === reading.seed.seed &&
      typeof state.seedFile.result === "object",
  );
  const seedTitle = !fileIn
    ? "Seed settings"
    : reading.race
      ? "Seed settings, from alttpr.com"
      : "Seed settings, from the ROM and alttpr.com";
  const time = new Date(reading.at).toLocaleTimeString();

  return (
    <section
      aria-labelledby={titleId}
      className="readout"
      data-testid="readout"
    >
      <h3 className="autotrack__heading" id={titleId}>
        What I read
      </h3>
      <p className="readout__meta">
        {live
          ? `Read at ${time}`
          : `Last read at ${time}, before the connection dropped`}
        . Compare it with your game.
        {reading.race &&
          " In Race Mode, what races forbid tracking is never read."}
      </p>
      <div className="readout__grid">
        <Group
          count={readout.items.length}
          testId="readout-items"
          title="Items"
          wide
        >
          <Chips entries={readout.items} />
        </Group>
        <Group
          count={readout.dungeons.length}
          testId="readout-dungeon-items"
          title="Dungeon items"
        >
          <dl className="readout__pairs">
            {readout.dungeons.map(({ dungeon, items }) => (
              <div className="readout__pair" key={dungeon}>
                <dt>{dungeon}</dt>
                <dd>{items.join(", ")}</dd>
              </div>
            ))}
          </dl>
        </Group>
        <Group
          count={readout.prizes.length}
          empty={
            readout.prizesUnread === null
              ? "None"
              : UNREAD[readout.prizesUnread]
          }
          testId="readout-prizes"
          title="Pendants and crystals"
        >
          <Chips entries={readout.prizes} />
        </Group>
        <Group count={1} testId="readout-progress" title="Progress">
          <ul className="readout__facts">
            {readout.progress.map(({ label, value }) => (
              <li
                className="readout__fact"
                data-value={String(value)}
                key={label}
              >
                <span aria-hidden="true" className="readout__mark">
                  {value === true ? "✓" : value === false ? "–" : "?"}
                </span>
                {label}
                <span className="readout__value">
                  {value === true ? "yes" : value === false ? "no" : WHY[value]}
                </span>
              </li>
            ))}
          </ul>
        </Group>
        <Group
          count={readout.bosses.length}
          testId="readout-bosses"
          title="Bosses defeated"
        >
          <Chips entries={readout.bosses} />
        </Group>
        <Group
          count={readout.completed.length}
          testId="readout-completed"
          title="Prizes taken"
        >
          <Chips entries={readout.completed} />
        </Group>
        <Group count={1} testId="readout-seed" title={seedTitle}>
          <dl className="readout__pairs">
            {readout.seed.map(({ label, value }) => (
              <div className="readout__pair" key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </Group>
        <Group
          count={readout.checkedCount}
          testId="readout-checked"
          title={`Locations checked (${readout.checkedCount})`}
        >
          <dl className="readout__pairs">
            {readout.checked.map(({ area, locations }) => (
              <div className="readout__pair" key={area}>
                <dt>{area}</dt>
                <dd>{locations.join(", ")}</dd>
              </div>
            ))}
          </dl>
        </Group>
        {readout.untracked.length > 0 && (
          <Group
            count={readout.untracked.length}
            testId="readout-untracked"
            title="Not on the board"
            wide
          >
            <Chips entries={readout.untracked} />
          </Group>
        )}
        {(["race-mode", "not-read"] as const).map((why) => {
          const labels = readout.withheld
            .filter((entry) => entry.why === why)
            .map((entry) => entry.label);
          return (
            labels.length > 0 && (
              <Group
                count={labels.length}
                key={why}
                testId={`readout-${why}`}
                title={UNREAD[why]}
                wide
              >
                <Chips entries={labels} />
              </Group>
            )
          );
        })}
      </div>
    </section>
  );
};
