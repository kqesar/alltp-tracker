import { beforeEach, describe, expect, it } from "vitest";
import { COMMANDS, type VoiceAction } from "@/logic/voice";
import { useGameStore } from "@/stores/gameStore";
import { applyVoice } from "@/voice/apply";

const store = () => useGameStore.getState();
/** Do what a phrase says, as the engine does once it hears it. */
const say = (phrase: string) => {
  const action = COMMANDS.get(phrase);
  if (!action) throw new Error(`No command "${phrase}"`);
  return applyVoice(action as VoiceAction);
};

beforeEach(() => {
  localStorage.clear();
  useGameStore.setState(useGameStore.getInitialState(), true);
});

describe("applyVoice", () => {
  it("marks a find as one undo step, and says what it marked", () => {
    expect(say("hook shot")).toEqual({ changed: true, words: "Hookshot" });
    expect(store().items.hookshot).toBe(true);
    expect(store().past).toHaveLength(1);

    // Saying it again keeps it, and records nothing
    expect(say("hook shot")).toEqual({ changed: false, words: "Hookshot" });
    expect(store().items.hookshot).toBe(true);
    expect(store().past).toHaveLength(1);
  });

  it("raises a level without wrapping round, and names one without lowering", () => {
    for (let i = 0; i < 5; i++) say("sword");
    expect(store().items.sword).toBe(4);
    say("master sword");
    expect(store().items.sword).toBe(4);
  });

  it("adds the bow's bits apart", () => {
    say("bow");
    expect(store().items.bow).toBe(2);
    say("silvers");
    expect(store().items.bow).toBe(3);
  });

  it("beats a boss, counts a dungeon's items down, picks prizes and medallions", () => {
    say("eastern boss");
    expect(store().items.boss0).toBe(2);
    say("eastern chest");
    expect(store().items.chest0).toBe(2);
    say("eastern green pendant");
    expect(store().items.reward0).toBe(1);
    say("mire ether");
    expect(store().medallions[8]).toBe(2);
  });

  it("leaves a key cell's control alone while the key cells are hidden", () => {
    expect(say("desert key")).toEqual({
      changed: false,
      words: "Desert Palace small keys",
    });
    expect(store().smallKeys[1]).toBe(0);

    store().setBigKeysVisible(true);
    expect(say("desert key").changed).toBe(true);
    expect(store().smallKeys[1]).toBe(1);
  });

  it("undoes, redoes and drives the timer, saying when there was nothing to do", () => {
    expect(say("undo").changed).toBe(false);
    say("hammer");
    expect(say("undo")).toEqual({ changed: true, words: "Undo" });
    expect(store().items.hammer).toBe(false);
    expect(say("redo").changed).toBe(true);
    expect(store().items.hammer).toBe(true);

    expect(say("start timer").changed).toBe(true);
    expect(say("start").changed).toBe(false);
    expect(say("pause").changed).toBe(true);
    expect(say("pause timer").changed).toBe(false);
  });
});
