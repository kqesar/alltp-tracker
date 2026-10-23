import { useEffect, useState } from "react";
import { clockNow } from "@/utils/clock";

/**
 * The clock, read again at each second's turn while `ticking`, so a running
 * timer redraws once a second, and only the component that shows it. It is
 * the run's clock (`clockNow`): a followed run's is its own computer's.
 * @param ticking - Whether the time moves on screen
 */
export const useNow = (ticking: boolean): number => {
  const [now, setNow] = useState(clockNow);
  useEffect(() => {
    setNow(clockNow());
    if (!ticking) return;
    let id: ReturnType<typeof setTimeout>;
    const tick = () => {
      const at = clockNow();
      setNow(at);
      id = setTimeout(tick, 1000 - (at % 1000));
    };
    id = setTimeout(tick, 1000 - (clockNow() % 1000));
    return () => clearTimeout(id);
  }, [ticking]);
  return now;
};
