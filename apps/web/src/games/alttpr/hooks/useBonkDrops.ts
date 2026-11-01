import { useEffect } from "react";
import {
  bonkDropsLoaded,
  bonkDropsOf,
  setBonkDrops,
} from "@/games/alttpr/data/doorRando";
import { useGameStore } from "@/games/alttpr/stores/gameStore";

/**
 * Loads the Overworld Randomizer's bonk drops (the pack's `./bonk` entry)
 * once the run shuffles them, so no other run downloads their data; the
 * store is set again as it was, so the Checks list, the map and
 * autotracking's tables take them up as they arrive.
 */
export const useBonkDrops = () => {
  const wanted = useGameStore((state) => bonkDropsOf(state.settings));
  useEffect(() => {
    if (!wanted || bonkDropsLoaded()) return;
    void import("@alltp/pack-alttpr/bonk").then(({ BONK_DROPS }) => {
      setBonkDrops(BONK_DROPS);
      useGameStore.setState({});
    });
  }, [wanted]);
};
