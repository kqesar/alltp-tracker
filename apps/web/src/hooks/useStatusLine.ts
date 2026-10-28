import { useCallback, useEffect, useState } from "react";

/** How long a status message such as "Save imported" stays on screen. */
const STATUS_DURATION_MS = 4000;

/**
 * What a message is: news of something done (`done`, drawn as success) or
 * the reason an action was refused (`refused`, drawn quietly).
 */
type StatusTone = "done" | "refused";

type StatusLine = {
  text: string;
  tone: StatusTone;
  /** Counts every message, the same one again included */
  count: number;
};

/**
 * A toolbar's status line: a message for a live region that clears itself.
 * @returns The message shown ("" for none), the setter, and what the line
 * draws it with: its tone, and a `count` to key the text on, so a message set
 * again is announced again. A new message, the same one too, restarts the
 * delay.
 */
export const useStatusLine = () => {
  const [line, setLine] = useState<StatusLine>({
    count: 0,
    text: "",
    tone: "done",
  });

  const setStatus = useCallback(
    (text: string, tone: StatusTone = "done") =>
      setLine((before) => ({ count: before.count + 1, text, tone })),
    [],
  );

  useEffect(() => {
    if (!line.text) return;
    // The effect runs for each message, as each makes a new `line`
    const timer = setTimeout(
      () => setLine((before) => ({ ...before, text: "" })),
      STATUS_DURATION_MS,
    );
    return () => clearTimeout(timer);
  }, [line]);

  return [
    line.text,
    setStatus,
    { count: line.count, tone: line.tone },
  ] as const;
};
