import type { Binding, SpoilerGame, SpoilerLog } from "@alltp/spoiler";
import { useId, useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import type { ReviewGate } from "@/review/gate";
import { readSpoiler } from "@/review/read";
import { useReviewStore } from "@/review/store";
import { refusalWords } from "@/review/words";

export type ReviewDialogProps = {
  onClose: () => void;
  game: SpoilerGame;
  /** The game's name, for the sentences. */
  gameName: string;
  /** Whether a review may open now. */
  gate: ReviewGate;
  /** The run's seed, which the review is bound to. */
  runSeed: string | null;
  /** Whether a log is the run's, by the game's own evidence. */
  bind: (log: SpoilerLog) => Binding;
  /** Called once the review is open, before the dialog closes. */
  onOpened?: () => void;
};

/**
 * The dialog that imports a spoiler log for a finished run: a file picker
 * and the reason when it is refused. The file is read on this device (in a
 * Web Worker, `review/read.ts`) and the result is held in memory only: it
 * never reaches storage, an export, a link, the stream view or the overlay.
 */
const ReviewDialog = ({
  bind,
  game,
  gameName,
  gate,
  onClose,
  onOpened,
  runSeed,
}: ReviewDialogProps) => {
  const inputId = useId();
  const open = useReviewStore((state) => state.open);
  const [reading, setReading] = useState(false);
  const [problem, setProblem] = useState("");
  // The gate as it stands when the read ends, not when it began
  const latest = useRef(gate);
  latest.current = gate;

  const pick = async (file: File | undefined) => {
    if (file === undefined) return;
    setProblem("");
    setReading(true);
    const result = await readSpoiler(file, game);
    setReading(false);
    if (latest.current !== "open") {
      setProblem(
        refusalWords(
          {
            error: latest.current === "race-mode" ? "race-mode" : "not-over",
            ok: false,
          },
          gameName,
        ),
      );
      return;
    }
    if (!result.ok) {
      setProblem(refusalWords(result, gameName));
      return;
    }
    const binding = bind(result.value);
    if (binding.verdict === "refused") {
      setProblem(refusalWords(binding.refusal, gameName));
      return;
    }
    open({
      binding,
      boundSeed: runSeed,
      fileName: file.name,
      game,
      log: result.value,
    });
    onOpened?.();
    onClose();
  };

  return (
    <Modal
      footer={
        <button
          className="modal-btn modal-btn--ghost"
          data-autofocus
          onClick={onClose}
          type="button"
        >
          Cancel
        </button>
      }
      isOpen
      onClose={onClose}
      title="Review this run"
    >
      <div className="review-dialog" data-testid="review-dialog">
        <p className="modal__message">
          Import the spoiler log of this run's seed to see where every item was
          and how the run compares with it. The file is read on this device and
          never sent anywhere. The review is not saved, exported or shared:
          reloading the page, starting another run or switching seed closes it.
        </p>
        {gate === "open" ? (
          <div className="review-dialog__pick">
            <label className="review-dialog__label" htmlFor={inputId}>
              Spoiler log file
            </label>
            <input
              accept=".txt,.json,.yaml,.yml,text/plain,application/json"
              className="review-dialog__file"
              data-testid="review-file"
              disabled={reading}
              id={inputId}
              onChange={(event) => {
                void pick(event.target.files?.[0]);
                // Picking the same file again must read it again
                event.target.value = "";
              }}
              type="file"
            />
          </div>
        ) : (
          <p className="review-dialog__refused" data-testid="review-gate">
            {refusalWords(
              {
                error: gate === "race-mode" ? "race-mode" : "not-over",
                ok: false,
              },
              gameName,
            )}
          </p>
        )}
        <p
          aria-live="polite"
          className="review-dialog__status"
          data-testid="review-status"
          role="status"
        >
          {reading ? "Reading the file…" : ""}
        </p>
        {problem !== "" && (
          <p
            className="review-dialog__error"
            data-testid="review-error"
            role="alert"
          >
            {problem}
          </p>
        )}
      </div>
    </Modal>
  );
};

export default ReviewDialog;
