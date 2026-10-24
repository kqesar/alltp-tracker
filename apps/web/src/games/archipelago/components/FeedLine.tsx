import { memo } from "react";
import { kindOf } from "@/games/archipelago/project";
import type { ApFeedEntry } from "@/games/archipelago/store";

/**
 * One feed line's words: players by name (the tracked slot's in bold),
 * items lettered by their kind (progression bold too, so weight says it as
 * well as colour), locations in italics. The board and the stream view draw
 * it alike.
 */
export const FeedWords = memo(({ entry }: { entry: ApFeedEntry }) => (
  <>
    {entry.parts.map((part, index) => {
      // A line's parts never move: the index is their identity
      const key = `${entry.seq}-${index}`;
      switch (part.kind) {
        case "player":
          return (
            <span className="ap-feed__player" data-me={part.me} key={key}>
              {part.text}
            </span>
          );
        case "item":
          return (
            <span
              className="ap-feed__item"
              data-kind={kindOf(part.flags ?? 0)}
              key={key}
            >
              {part.text}
            </span>
          );
        case "location":
          return (
            <span className="ap-feed__location" key={key}>
              {part.text}
            </span>
          );
        case "status":
          return (
            <span className="ap-feed__status" key={key}>
              {part.text}
            </span>
          );
        default:
          return part.text;
      }
    })}
  </>
));

/** A line's words as plain text: what the announcer says. */
export const lineText = (entry: ApFeedEntry) =>
  entry.parts.map((part) => part.text).join("");
