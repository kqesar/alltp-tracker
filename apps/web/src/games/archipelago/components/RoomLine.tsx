import { StatusDot } from "@/components/autotrack/StatusDot";
import { useApConnectionStore } from "@/games/archipelago/connection";
import { headlineOf, phaseOf } from "@/games/archipelago/status";
import { useArchipelagoStore } from "@/games/archipelago/store";

/**
 * The room at a glance: the slot, its game and team, how many players, a
 * Race seed badge when the room says so, and the connection's state, said
 * politely as it changes. Never where the room is: the line is on stream.
 */
export const RoomLine = () => {
  const room = useArchipelagoStore((state) => state.room);
  const players = useArchipelagoStore((state) => state.players.length);
  const race = useArchipelagoStore((state) => state.raceMode);
  const status = useApConnectionStore((state) => state.status);
  const phase = phaseOf(status);
  return (
    <section aria-label="Room" className="ap-room" data-testid="ap-room">
      {room === null ? (
        <p className="ap-room__slot">No room yet</p>
      ) : (
        <p className="ap-room__slot" data-testid="ap-room-slot">
          <strong>{room.slotName}</strong>
          {" · "}
          {room.game}
          {" · "}
          Team {room.team + 1}
        </p>
      )}
      {room !== null && (
        <p className="ap-room__players" data-testid="ap-room-players">
          {players === 1 ? "1 player" : `${players} players`}
        </p>
      )}
      {race === true && (
        <span
          className="race-badge"
          data-testid="ap-race-badge"
          title="The room was generated as a race: its spoiler and slot data stay hidden."
        >
          Race seed
        </span>
      )}
      <p className="ap-room__status" data-phase={phase}>
        <StatusDot phase={phase} />
        <span data-testid="ap-room-status" role="status">
          {headlineOf(status)}
        </span>
      </p>
    </section>
  );
};
