import { useId } from "react";
import { CloseIcon } from "@/components/ui/ToolbarIcons";
import { useApConnectionStore } from "@/games/archipelago/connection";

/** How many items the card lists; the rest are counted. */
const LISTED = 12;

/**
 * "While you were away": the items the slot received while the board was
 * not connected (a reload, a drop, a closed laptop), with who sent each and
 * from where, as the connection that came back resent them. Said once,
 * politely; it stays until dismissed or the next reconnection.
 */
export const AwayNotice = () => {
  const away = useApConnectionStore((state) => state.away);
  const id = useId();
  const items = away ?? [];
  return (
    <div className="notice" data-testid="ap-away-region" role="status">
      {items.length > 0 && (
        <section
          aria-labelledby={id}
          className="notice__card ap-away"
          data-testid="ap-away"
        >
          <div className="ap-away__body">
            <h2 className="ap-away__title" id={id}>
              While you were away: {items.length}{" "}
              {items.length === 1 ? "item" : "items"}
            </h2>
            <ul className="ap-away__list">
              {items.slice(0, LISTED).map((item, index) => (
                <li
                  className="ap-away__item"
                  // The list is the server's order and never changes in place
                  // biome-ignore lint/suspicious/noArrayIndexKey: see above
                  key={index}
                >
                  <span className="ap-feed__item">{item.item}</span>
                  {" from "}
                  <span className="ap-feed__player">{item.sender}</span>
                  {" ("}
                  <span className="ap-feed__location">{item.location}</span>
                  {")"}
                </li>
              ))}
            </ul>
            {items.length > LISTED && (
              <p className="ap-away__more">
                and {items.length - LISTED} more, in the items
              </p>
            )}
          </div>
          <div className="notice__actions">
            <button
              aria-label="Dismiss"
              className="notice__button"
              data-testid="ap-away-dismiss"
              onClick={() => useApConnectionStore.setState({ away: null })}
              type="button"
            >
              <CloseIcon />
            </button>
          </div>
        </section>
      )}
    </div>
  );
};
