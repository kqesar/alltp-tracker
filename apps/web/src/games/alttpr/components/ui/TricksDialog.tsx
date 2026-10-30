import { TRICK_IDS, type TrickId, tricksInLogic } from "@alltp/pack-alttpr";
import { useEffect, useId } from "react";
import { useShallow } from "zustand/react/shallow";
import { Modal } from "@/components/ui/Modal";
import { OutLink } from "@/components/ui/OutLink";
import {
  crossedLogic,
  doorLogic,
  logicModelled,
} from "@/games/alttpr/data/presets";
import {
  MINOR_GLITCHES_GUIDE,
  TRICK_WORDS,
  type TrickPrefs,
  withTrick,
} from "@/games/alttpr/data/tricks";
import { whenIdle } from "@/games/alttpr/hooks/useRunAnalysis";
import { packSettings } from "@/games/alttpr/logic/settings";
import { warmTricks } from "@/games/alttpr/logic/solution";
import { useGameStore } from "@/games/alttpr/stores/gameStore";

/** "A", "A and B", "A, B and C". */
const listOf = (items: readonly string[]) =>
  items.length < 2
    ? items.join("")
    : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

/** One trick: its checkbox, what it does and where to learn it. */
const TrickRow = ({
  id,
  setTricks,
  tricks,
}: {
  id: TrickId;
  setTricks: (tricks: TrickPrefs) => void;
  tricks: TrickPrefs;
}) => {
  const known = tricks.techniques.includes(id);
  const inputId = useId();
  const { guides, name, summary } = TRICK_WORDS[id];
  return (
    <li className="trick-row">
      <div className="check-option">
        <input
          aria-describedby={`${inputId}-summary`}
          checked={known}
          className="check-option__input"
          data-testid={`trick-${id}`}
          id={inputId}
          onChange={(event) => {
            setTricks({
              ...tricks,
              techniques: withTrick(
                tricks.techniques,
                id,
                event.target.checked,
              ),
            });
          }}
          type="checkbox"
        />
        <label htmlFor={inputId}>{name}</label>
      </div>
      <p className="run-display__hint" id={`${inputId}-summary`}>
        {summary}
      </p>
      <ul className="trick-row__guides">
        {guides.map((guide) => (
          <li key={guide.url}>
            <OutLink label={guide.label} url={guide.url} />
          </li>
        ))}
      </ul>
    </li>
  );
};

/**
 * The tricks the map can mark checks with: a switch, and the tricks the
 * player knows, each with a line on what it does and where to learn it. A
 * preference of this device, so a change is no undo step and no run's.
 * @param isOpen - Whether the dialog is shown
 * @param onClose - Called to dismiss it
 */
export const TricksDialog = ({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) => {
  const tricks = useGameStore((state) => state.tricks);
  const { enabled } = tricks;
  const setTricks = useGameStore((state) => state.setTricks);
  const modelled = useGameStore(
    (state) =>
      logicModelled(state.settings) &&
      !crossedLogic(state.settings) &&
      !doorLogic(state.settings),
  );
  const switchId = useId();
  const settings = useGameStore((state) => state.settings);
  // A glitched logic counts some tricks already (Overworld Glitches: four)
  const inLogic = useGameStore(
    useShallow((state) =>
      logicModelled(state.settings)
        ? tricksInLogic(packSettings(state.settings))
        : [],
    ),
  );
  // The tricks world compiles in about 50 ms: let it happen while the player
  // reads, not when the switch is ticked
  useEffect(
    () => (isOpen ? whenIdle(() => warmTricks(settings)) : undefined),
    [isOpen, settings],
  );
  return (
    <Modal
      footer={
        <button
          className="modal-btn modal-btn--primary"
          data-autofocus
          onClick={onClose}
          type="button"
        >
          Done
        </button>
      }
      isOpen={isOpen}
      onClose={onClose}
      title="Tricks"
      wide
    >
      <div className="tricks-dialog">
        <p>
          The tracker's logic never counts on a trick. With the switch below, a
          check that is out of logic but that a trick you know would open shows
          a lightning bolt on purple, by the rules of the randomizer's glitched
          logic. Nothing is read from the game, and Race Mode is unchanged.
        </p>
        {inLogic.length > 0 && (
          <p className="tricks-dialog__note" data-testid="tricks-in-logic">
            This run's logic counts{" "}
            {listOf(inLogic.map((id) => TRICK_WORDS[id].name))} already: the
            checks they open are in logic, and only the others are marked.
          </p>
        )}
        {!modelled && (
          <p className="tricks-dialog__note" data-testid="tricks-unsupported">
            This run's logic has no tricks yet (shuffled entrances, a Door
            Randomizer seed, a glitched logic, or logic not modelled): nothing
            is marked.
          </p>
        )}
        <div className="check-option">
          <input
            checked={enabled}
            className="check-option__input"
            data-testid="tricks-enabled"
            id={switchId}
            onChange={(event) =>
              setTricks({
                ...tricks,
                enabled: event.target.checked,
              })
            }
            type="checkbox"
          />
          <label htmlFor={switchId}>Mark checks these tricks open</label>
        </div>
        <fieldset className="tricks-dialog__list" disabled={!enabled}>
          <legend>Tricks I know</legend>
          <ul>
            {TRICK_IDS.map((id) => (
              <TrickRow
                id={id}
                key={id}
                setTricks={setTricks}
                tricks={tricks}
              />
            ))}
          </ul>
        </fieldset>
        <p className="tricks-dialog__more">
          All but the dark rooms, in one document:{" "}
          <OutLink
            label={MINOR_GLITCHES_GUIDE.label}
            url={MINOR_GLITCHES_GUIDE.url}
          />
        </p>
      </div>
    </Modal>
  );
};
