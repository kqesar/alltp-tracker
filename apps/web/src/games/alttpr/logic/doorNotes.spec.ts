import { describe, expect, it } from "vitest";
import {
  linkChange,
  linkOf,
  withDoorNotes,
} from "@/games/alttpr/logic/doorNotes";

describe("door notes", () => {
  it("lays a change on the notes, the same object when nothing moves", () => {
    const notes = { kinds: { a: "small" as const } };
    expect(withDoorNotes(notes, { kinds: { a: "small" } })).toBe(notes);
    expect(withDoorNotes(notes, {})).toBe(notes);
    expect(withDoorNotes(notes, { kinds: { a: null } })).toEqual({});
    expect(
      withDoorNotes(notes, {
        keys: { "Eastern Palace": 2 },
        lobbies: { x: "y" },
      }),
    ).toEqual({
      keys: { "Eastern Palace": 2 },
      kinds: { a: "small" },
      lobbies: { x: "y" },
    });
    expect(withDoorNotes({}, { links: { a: null } })).toEqual({});
  });

  it("keeps only what is noted, a coupled door's way back derived", () => {
    const first = withDoorNotes({}, linkChange({}, "a", "b", true));
    // No kind with it, and no way back stored: it is derived
    expect(first).toEqual({ links: { a: "b" } });
    expect(linkOf(first.links, "b", true)).toBe("a");
    // Decoupled, the same notes infer nothing (the stored way back of an
    // earlier coupled reading never turns into an observation)
    expect(linkOf(first.links, "b", false)).toBeUndefined();
    // a now leads into c: b's way back goes with the note
    const moved = withDoorNotes(first, linkChange(first, "a", "c", true));
    expect(moved.links).toEqual({ a: "c" });
    expect(linkOf(moved.links, "b", true)).toBeUndefined();
    // d into c: a, which c led back into, leads nowhere known
    const taken = withDoorNotes(moved, linkChange(moved, "d", "c", true));
    expect(taken.links).toEqual({ d: "c" });
    expect(linkOf(taken.links, "c", true)).toBe("d");
    // c noted from its own side: the pair it was in goes, c's note stays
    const back = withDoorNotes(taken, linkChange(taken, "c", "e", true));
    expect(back.links).toEqual({ c: "e" });
    // Forgotten from the side derived: the note it rests on goes
    expect(
      withDoorNotes(back, linkChange(back, "e", null, true)).links,
    ).toBeUndefined();
    // Noting what is already held moves nothing
    expect(withDoorNotes(back, linkChange(back, "c", "e", true))).toBe(back);
    // A kind noted stays as it is
    expect(
      withDoorNotes(
        { kinds: { a: "small" } },
        linkChange({ kinds: { a: "small" } }, "a", "b", true),
      ).kinds,
    ).toEqual({ a: "small" });
  });

  it("notes a decoupled door one way", () => {
    const first = withDoorNotes({}, linkChange({}, "a", "b", false));
    expect(first.links).toEqual({ a: "b" });
    const back = withDoorNotes(first, linkChange(first, "b", "c", false));
    expect(back.links).toEqual({ a: "b", b: "c" });
    // Another door into b: a's link to it goes
    expect(
      withDoorNotes(back, linkChange(back, "d", "b", false)).links,
    ).toEqual({ b: "c", d: "b" });
  });
});
