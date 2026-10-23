import { useEffect, useState } from "react";

/** How long a status message such as "Save imported" stays on screen. */
const STATUS_DURATION_MS = 4000;

/**
 * A toolbar's status line: a message for a live region that clears itself.
 * @returns The message shown ("" for none) and the setter; a new message
 * restarts the delay
 */
export const useStatusLine = () => {
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!status) return;
    const timer = setTimeout(() => setStatus(""), STATUS_DURATION_MS);
    return () => clearTimeout(timer);
  }, [status]);

  return [status, setStatus] as const;
};
