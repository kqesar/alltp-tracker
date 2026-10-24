import { StreamTimer as Timer } from "@/components/ui/StreamTimer";
import { useGameStore } from "@/games/alttpr/stores/gameStore";

/** ALttPR's stream view timer (`&timer=1`): the shared one over the run's. */
export const StreamTimer = () => (
  <Timer timer={useGameStore((state) => state.timer)} />
);
