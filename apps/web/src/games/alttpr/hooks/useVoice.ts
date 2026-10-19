import { useEffect } from "react";
import {
  shutdownVoice,
  startVoice,
  useVoiceStore,
} from "@/games/alttpr/stores/voiceStore";

/**
 * Voice commands' lifetime in the tracker: nothing is loaded, and no
 * microphone opened, until the player turns them on; once they have, the
 * tracker listens again as it opens (remembered on this device), and stops
 * with it. The tracker alone calls it: the stream view never listens.
 */
export const useVoice = () => {
  useEffect(() => {
    if (useVoiceStore.getState().enabled) void startVoice();
    return shutdownVoice;
  }, []);
};
