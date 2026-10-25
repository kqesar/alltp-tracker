import { seedHashOf } from "@alltp/pack-alttpr";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { isRaceModeOn } from "@/autotrack/raceMode";
import {
  checkSeed,
  type Run,
  type SeedCheck,
  seedLineText,
} from "@/games/alttpr/autotrack/seed";
import {
  loadSeedFile,
  type SeedFileError,
} from "@/games/alttpr/autotrack/seedFile";
import { useAutotrackStore } from "@/games/alttpr/stores/autotrackStore";

/** What the form says when alttpr.com gives no settings. */
const ERRORS: Readonly<Record<SeedFileError, string>> = {
  "not-found": "alttpr.com has no seed with this hash.",
  offline: "alttpr.com could not be reached. Try again once online.",
  unrecognized: "This seed's file on alttpr.com is not one the tracker reads.",
};

/** A seed whose run type differs from the board's. */
export type SeedSwitch = Extract<SeedCheck, { kind: "differs" }>;

/**
 * SeedImport - starts a run from an alttpr.com seed: its link or hash names
 * its file, whose settings name the run type. A seed of another run type
 * goes to `onSwitch`; the form says anything else in its status line. In
 * Race Mode it fetches nothing and says why instead of the form.
 * @param run - The board's run type and settings
 * @param onSwitch - Called with a seed of another run type
 */
export const SeedImport = ({
  onSwitch,
  run,
}: {
  onSwitch: (seed: SeedSwitch) => void;
  run: Run;
}) => {
  const inputId = useId();
  const race = useAutotrackStore(isRaceModeOn);
  const [text, setText] = useState("");
  const [message, setMessage] = useState("");
  // The last load asked: an earlier one's answer, or one after the form
  // closed, is dropped
  const asked = useRef(0);
  useEffect(
    () => () => {
      asked.current++;
    },
    [],
  );

  const load = async (event: FormEvent) => {
    event.preventDefault();
    if (race) return;
    const hash = seedHashOf(text);
    if (hash === null) {
      setMessage("Paste the seed's link from alttpr.com, or its hash.");
      return;
    }
    const mine = ++asked.current;
    setMessage("Asking alttpr.com…");
    const file = await loadSeedFile(hash);
    if (mine !== asked.current) return;
    if (typeof file === "string") {
      setMessage(ERRORS[file]);
      return;
    }
    const check = checkSeed(file, run);
    if (check.kind === "differs") {
      setMessage("");
      onSwitch(check);
    } else {
      setMessage(seedLineText(check, false));
    }
  };

  if (race) {
    return (
      <div className="seed-import" data-testid="seed-import">
        <p className="seed-import__label">Start from a seed</p>
        <p className="seed-import__status" data-testid="seed-import-race">
          Off in Race Mode: during a race the tracker asks alttpr.com for
          nothing, since a seed's file holds where every item is. Pick the run
          type below.
        </p>
      </div>
    );
  }

  return (
    <form className="seed-import" data-testid="seed-import" onSubmit={load}>
      <label className="seed-import__label" htmlFor={inputId}>
        Start from a seed
      </label>
      <div className="seed-import__row">
        <input
          autoComplete="off"
          className="seed-import__input"
          data-testid="seed-import-input"
          id={inputId}
          onChange={(event) => setText(event.target.value)}
          placeholder="alttpr.com link or hash"
          spellCheck={false}
          type="text"
          value={text}
        />
        <button
          className="modal-btn modal-btn--primary"
          data-testid="seed-import-load"
          type="submit"
        >
          Load
        </button>
      </div>
      <p
        className="seed-import__status"
        data-testid="seed-import-status"
        role="status"
      >
        {message}
      </p>
    </form>
  );
};
