import { memo, useEffect, useId, useMemo, useRef, useState } from "react";
import { FeedWords, lineText } from "@/games/archipelago/components/FeedLine";
import { PROGRESSION } from "@/games/archipelago/project";
import {
  type ApFeedEntry,
  useArchipelagoStore,
} from "@/games/archipelago/store";

const SCOPES = [
  { label: "Involving me", value: "mine" },
  { label: "Whole room", value: "room" },
] as const;

const Line = memo(({ entry }: { entry: ApFeedEntry }) => (
  <li
    className="ap-feed__line"
    data-kind={entry.kind}
    data-mine={entry.mine}
    data-testid="ap-feed-line"
  >
    <FeedWords entry={entry} />
  </li>
));

/** A progression item the slot received: what may be announced. */
const announced = (entry: ApFeedEntry) =>
  entry.received && (entry.flags & PROGRESSION) !== 0;

/**
 * Says each progression item the slot receives, once, while the player asks
 * for it ("Announce items I receive"): a polite live region apart from the
 * log, which stays silent. Lines already there when it mounts or when it is
 * turned on are never said.
 */
const Announcer = ({ feed }: { feed: readonly ApFeedEntry[] }) => {
  const on = useArchipelagoStore((state) => state.prefs.announce);
  const last = feed.at(-1)?.seq ?? -1;
  const seen = useRef(last);
  const [words, setWords] = useState("");
  useEffect(() => {
    // Off, or another run's feed (its lines count from 0 again): say nothing
    if (!on || last < seen.current) {
      seen.current = last;
      return;
    }
    const fresh = feed.filter(
      (entry) => entry.seq > seen.current && announced(entry),
    );
    seen.current = last;
    if (fresh.length > 0) setWords(fresh.map(lineText).join(". "));
  }, [feed, last, on]);
  return (
    <p className="sr-only" data-testid="ap-feed-announcer" role="status">
      {on ? words : ""}
    </p>
  );
};

/**
 * The room's feed, newest first: the items sent and found, hints, goals,
 * releases and collects (one line a burst), players joining and leaving, the
 * countdown, as the server prints them; no chat. "Involving me" by default,
 * or the whole room. A `role="log"` that is not announced (`aria-live="off"`):
 * a busy room would talk over the game; the player may ask for the items
 * they receive to be said.
 */
export const FeedPanel = () => {
  const feed = useArchipelagoStore((state) => state.feed);
  const scope = useArchipelagoStore((state) => state.prefs.feedScope);
  const announce = useArchipelagoStore((state) => state.prefs.announce);
  const setPref = useArchipelagoStore((state) => state.setPref);
  const id = useId();
  const shown = useMemo(
    () =>
      (scope === "mine" ? feed.filter((entry) => entry.mine) : feed)
        .slice()
        .reverse(),
    [feed, scope],
  );

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="ap-panel ap-feed"
      data-testid="ap-feed"
    >
      <h2 className="ap-panel__heading" id={`${id}-title`}>
        Feed
      </h2>
      <div className="ap-feed__tools">
        <fieldset className="ap-feed__scope">
          <legend className="sr-only">Show</legend>
          {SCOPES.map(({ label, value }) => (
            <label className="ap-feed__choice" key={value}>
              <input
                checked={scope === value}
                data-testid={`ap-feed-scope-${value}`}
                name={`${id}-scope`}
                onChange={() => setPref("feedScope", value)}
                type="radio"
              />
              {label}
            </label>
          ))}
        </fieldset>
        <label className="ap-feed__choice">
          <input
            checked={announce}
            data-testid="ap-feed-announce"
            onChange={(event) => setPref("announce", event.target.checked)}
            type="checkbox"
          />
          Announce items I receive
        </label>
      </div>
      {shown.length === 0 ? (
        <p className="ap-panel__empty" data-testid="ap-feed-empty">
          {scope === "mine"
            ? "Nothing involving you yet. Items you send and receive show here."
            : "Nothing in the room yet."}
        </p>
      ) : (
        // The log scrolls: focusable, so a keyboard scrolls it too
        <div
          aria-labelledby={`${id}-title`}
          aria-live="off"
          className="ap-feed__log"
          data-scope={scope}
          data-testid="ap-feed-lines"
          role="log"
          // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrolling region a keyboard must reach (WCAG 2.1.1)
          tabIndex={0}
        >
          <ol className="ap-feed__lines">
            {shown.map((entry) => (
              <Line entry={entry} key={entry.seq} />
            ))}
          </ol>
        </div>
      )}
      <Announcer feed={feed} />
    </section>
  );
};
