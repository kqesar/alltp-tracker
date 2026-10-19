import { GAME_IDS, GAMES, type GameId, switchGame } from "@/games/registry";

type GamePickerProps = {
  /** The game this page tracks. */
  current: GameId;
  /** Called instead of switching, for tests; the page reloads by default. */
  onSwitch?: (id: GameId) => void;
};

/**
 * The game this device tracks, and the others it can: one button each, the
 * current one pressed. Buttons rather than radios, so arrowing through them
 * never switches: picking another game loads the page again with its own
 * board, each game keeping its run.
 */
export const GamePicker = ({
  current,
  onSwitch = switchGame,
}: GamePickerProps) => (
  <fieldset className="game-picker" data-testid="game-picker">
    <legend className="game-picker__label">Game</legend>
    <div className="game-picker__games">
      {GAME_IDS.map((id) => (
        <button
          aria-label={`${GAMES[id].name}, ${GAMES[id].randomizer}`}
          aria-pressed={id === current}
          className="game-picker__game"
          data-testid={`game-${id}`}
          key={id}
          onClick={() => {
            if (id !== current) onSwitch(id);
          }}
          type="button"
        >
          <span className="game-picker__name">{GAMES[id].name}</span>
          <span className="game-picker__randomizer">
            {GAMES[id].randomizer}
          </span>
        </button>
      ))}
    </div>
    <p className="game-picker__note">Each game keeps its own run.</p>
  </fieldset>
);
