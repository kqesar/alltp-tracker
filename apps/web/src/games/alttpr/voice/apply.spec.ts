import { beforeEach, describe, expect, it } from "vitest";
import { COMMANDS, type VoiceAction } from "@/games/alttpr/logic/voice";
import { useGameStore } from "@/games/alttpr/stores/gameStore";
import { applyVoice } from "@/games/alttpr/voice/apply";

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

  it("finds hearts and heart pieces, the fourth piece making a heart", () => {
    // From not set: the 3 Link starts with and the one found
    expect(say("heart")).toEqual({ changed: true, words: "Hearts" });
    expect(store().items).toMatchObject({ heartquarters: 0, hearts: 2 });
    say("heart piece");
    say("piece of heart");
    expect(store().items).toMatchObject({ heartquarters: 2, hearts: 2 });
    // A whole heart keeps the pieces toward the next
    say("heart container");
    expect(store().items).toMatchObject({ heartquarters: 2, hearts: 3 });
    say("heart piece");
    say("heart piece");
    expect(store().items).toMatchObject({ heartquarters: 0, hearts: 4 });
    // Each find one undo step
    expect(store().past).toHaveLength(6);
    // A piece from not set: the 3 starting hearts and a quarter
    useGameStore.setState(useGameStore.getInitialState(), true);
    say("heart piece");
    expect(store().items).toMatchObject({ heartquarters: 1, hearts: 1 });
  });

  it("finds a bottle by its place, then steps what it holds", () => {
    expect(say("second bottle")).toEqual({ changed: true, words: "Bottle 2" });
    expect(store().items).toMatchObject({ bottle: 2, bottlecontents2: 0 });
    say("bottle two");
    expect(store().items.bottlecontents2).toBe(1);
    expect(store().past).toHaveLength(2);
  });

  it("adds a capacity upgrade of 5, never past the most a seed gives", () => {
    expect(say("bomb upgrade")).toEqual({ changed: true, words: "Bombs" });
    expect(store().items.bombcapacity).toBe(15);
    for (let i = 0; i < 6; i++) say("quiver");
    expect(store().items.arrowcapacity).toBe(60);
    say("arrow upgrade");
    say("arrow upgrade");
    expect(store().items.arrowcapacity).toBe(70);
    expect(say("arrow upgrade").changed).toBe(false);
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

  it("marks a shop found in a retro run only, whose board shows the shops", () => {
    expect(say("key shop")).toEqual({ changed: false, words: "Key shop" });
    expect(store().items.shopkey).toBe(false);

    store().applyPreset("retro");
    expect(say("key shop")).toEqual({ changed: true, words: "Key shop" });
    expect(say("arrow shop").changed).toBe(true);
    expect(store().items).toMatchObject({ shoparrow: true, shopkey: true });
  });

  it("counts a Triforce piece found in a triforce hunt only, whose board shows the cell", () => {
    expect(say("tri force")).toEqual({
      changed: false,
      words: "Triforce pieces",
    });
    expect(store().items.triforce).toBe(0);

    store().applyPreset("triforce-hunt");
    expect(say("tri force")).toEqual({
      changed: true,
      words: "Triforce pieces",
    });
    expect(say("try force").changed).toBe(true);
    expect(say("tri force piece").changed).toBe(true);
    expect(store().items.triforce).toBe(3);
    // Each find one undo step
    expect(store().past).toHaveLength(4);
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
