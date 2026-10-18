import { useEffect, useState } from "react";

/**
 * The clock, read again at each second's turn while `ticking`, so a running
 * timer redraws once a second, and only the component that shows it.
 * @param ticking - Whether the time moves on screen
 */
export const useNow = (ticking: boolean): number => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    if (!ticking) return;
    let id: ReturnType<typeof setTimeout>;
    const tick = () => {
      const at = Date.now();
      setNow(at);
      id = setTimeout(tick, 1000 - (at % 1000));
    };
    id = setTimeout(tick, 1000 - (Date.now() % 1000));
    return () => clearTimeout(id);
  }, [ticking]);
  return now;
};
