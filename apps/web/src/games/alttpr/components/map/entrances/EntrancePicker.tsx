import type {
  CrossedPool,
  EntranceTarget,
  OverworldEntrance,
} from "@alltp/pack-alttpr";
import { useId, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import {
  entranceById,
  KIND_HEADINGS,
  notesFor,
  poolOf,
  targetsFor,
  targetText,
} from "@/games/alttpr/logic/entrances";
import { useEntrancePicker } from "@/games/alttpr/stores/entrancePickerStore";
import { useGameStore } from "@/games/alttpr/stores/gameStore";

/** The kinds in the order the picker lists them. */
const KINDS: readonly EntranceTarget["kind"][] = [
  "dungeon",
  "connector",
  "single",
  "drop",
];

/** Whether every word of a search is in a target's words. */
const matches = (target: EntranceTarget, words: readonly string[]) => {
  const text = targetText(target).toLowerCase();
  return words.every((word) => text.includes(word));
};

/**
 * Where an entrance may lead, searchable and grouped by kind. A target
 * another entrance leads to says which: choosing it moves it here.
 */
const PickerBody = ({
  entrance,
  pool,
}: {
  entrance: OverworldEntrance;
  pool: CrossedPool;
}) => {
  const close = useEntrancePicker((state) => state.close);
  const entrances = useGameStore((state) => state.entrances);
  const noteEntrance = useGameStore((state) => state.noteEntrance);
  const noteEntrances = useGameStore((state) => state.noteEntrances);
  const [query, setQuery] = useState("");
  const searchId = useId();
  const headingId = useId();

  const current = entrances[entrance.id];
  // Which entrance each noted target is at, by the entrance's words
  const at = new Map(
    Object.entries(entrances).flatMap(([id, target]) => {
      const from = entranceById(id);
      return from === undefined || id === entrance.id
        ? []
        : [[target, from.label] as const];
    }),
  );
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const options = targetsFor(pool, entrance).filter((t) => matches(t, words));
  const note = (target: string | null) => {
    // A hole and its cave's door are settled together, as one step
    if (target === null) noteEntrance(entrance.id, null);
    else noteEntrances(notesFor(pool, entrance.id, target));
    close();
  };

  return (
    <Modal
      footer={
        <>
          {current !== undefined && (
            <button
              className="button"
              data-testid="entrance-forget"
              onClick={() => note(null)}
              type="button"
            >
              Not known
            </button>
          )}
          <button className="button" onClick={close} type="button">
            Cancel
          </button>
        </>
      }
      isOpen
      onClose={close}
      title={`Where does ${entrance.label}${entrance.kind === "hole" ? " (hole)" : ""} lead?`}
      wide
    >
      <div className="entrance-picker" data-testid="entrance-picker">
        <label className="checks__field" htmlFor={searchId}>
          <span className="checks__field-label">Search</span>
          <input
            autoComplete="off"
            className="checks__input"
            data-autofocus
            id={searchId}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="Place or side"
            type="search"
            value={query}
          />
        </label>
        {options.length === 0 && (
          <p className="entrance-picker__empty" role="status">
            No place matches “{query}”.
          </p>
        )}
        {KINDS.map((kind) => {
          const list = options.filter((t) => t.kind === kind);
          if (list.length === 0) return null;
          return (
            <section
              aria-labelledby={`${headingId}-${kind}`}
              className="entrance-picker__group"
              key={kind}
            >
              <h3
                className="entrance-picker__heading"
                id={`${headingId}-${kind}`}
              >
                {KIND_HEADINGS[kind]}
              </h3>
              <ul className="entrance-picker__list">
                {list.map((target) => {
                  const elsewhere = at.get(target.id);
                  return (
                    <li key={target.id}>
                      <button
                        aria-pressed={current === target.id}
                        className={`entrance-option entrance-option--${target.kind}`}
                        data-testid={`entrance-option-${target.id}`}
                        onClick={() => note(target.id)}
                        type="button"
                      >
                        <span className="entrance-option__name">
                          {targetText(target)}
                        </span>
                        {elsewhere !== undefined && (
                          <span className="entrance-option__at">
                            at {elsewhere}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </Modal>
  );
};

/**
 * The destination picker, open while an entrance is being noted (the
 * picker store). Loaded on demand, with the entrance randomizer's tables.
 */
const EntrancePicker = () => {
  const picking = useEntrancePicker((state) => state.picking);
  const pool = useGameStore((state) => poolOf(state.settings));
  const entrance = picking === null ? undefined : entranceById(picking);
  // A fresh body, its search empty, for each entrance
  return entrance === undefined || pool === null ? null : (
    <PickerBody entrance={entrance} key={entrance.id} pool={pool} />
  );
};

export default EntrancePicker;
