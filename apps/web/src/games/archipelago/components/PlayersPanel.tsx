import { clientStatusName } from "@alltp/archipelago";
import { useId } from "react";
import { useArchipelagoStore } from "@/games/archipelago/store";

/** Each client status in words (AP 0.6's ClientStatus). */
const STATUS_WORDS = {
  connected: "Connected",
  goal: "Goal",
  playing: "Playing",
  ready: "Ready",
  unknown: "Not connected",
} as const;

/**
 * The room's players: each slot's name, game and where its game stands, as
 * the server keeps it (`_read_client_status`), in words. Outside a race,
 * the slot's settings as the room sends them, as information: the board
 * reads nothing into them.
 */
export const PlayersPanel = () => {
  const players = useArchipelagoStore((state) => state.players);
  const me = useArchipelagoStore((state) => state.room?.slot);
  const slotData = useArchipelagoStore((state) => state.slotData);
  const race = useArchipelagoStore((state) => state.raceMode);
  const id = useId();
  const settings = slotData === null ? [] : Object.entries(slotData);
  return (
    <div className="ap-players" data-testid="ap-players">
      {players.length === 0 ? (
        <p className="ap-panel__empty">No room yet.</p>
      ) : (
        <ul aria-label="Players" className="ap-players__list">
          {players.map((player) => (
            <li
              className="ap-player"
              data-status={
                player.status === null
                  ? "unknown"
                  : clientStatusName(player.status)
              }
              data-testid={`ap-player-${player.slot}`}
              key={player.slot}
            >
              <span className="ap-player__name">
                {player.name}
                {player.slot === me && (
                  <span className="ap-player__you"> (you)</span>
                )}
              </span>
              <span className="ap-player__game">{player.game}</span>
              <span className="ap-player__status">
                {player.status === null
                  ? "—"
                  : STATUS_WORDS[clientStatusName(player.status)]}
              </span>
            </li>
          ))}
        </ul>
      )}
      {race === true ? (
        <p className="ap-panel__empty" data-testid="ap-slot-data-race">
          A race seed: the board shows none of the slot's settings.
        </p>
      ) : (
        settings.length > 0 && (
          <details className="ap-slot-data" data-testid="ap-slot-data">
            <summary className="ap-slot-data__summary" id={id}>
              Your slot's settings, as the room sends them
            </summary>
            <dl aria-labelledby={id} className="ap-slot-data__list">
              {settings.map(([key, value]) => (
                <div className="ap-slot-data__entry" key={key}>
                  <dt>{key}</dt>
                  <dd>{String(value)}</dd>
                </div>
              ))}
            </dl>
          </details>
        )
      )}
    </div>
  );
};
