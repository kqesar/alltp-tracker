import { describe, expect, it } from "vitest";
import { linkChange, withDoorNotes } from "@/games/alttpr/logic/doorNotes";

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

  it("notes a coupled door's way back, and forgets the links it replaces", () => {
    const first = withDoorNotes({}, linkChange({}, "a", "b", true));
    expect(first).toEqual({
      kinds: { a: "normal", b: "normal" },
      links: { a: "b", b: "a" },
    });
    // a now leads into c: b's way back is forgotten
    const moved = withDoorNotes(first, linkChange(first, "a", "c", true));
    expect(moved.links).toEqual({ a: "c", c: "a" });
    // d into c: a, which c led back into, leads nowhere known
    const taken = withDoorNotes(moved, linkChange(moved, "d", "c", true));
    expect(taken.links).toEqual({ c: "d", d: "c" });
    // Forgotten, both ways
    expect(
      withDoorNotes(taken, linkChange(taken, "d", null, true)).links,
    ).toBeUndefined();
    // A kind noted stays
    expect(linkChange({ kinds: { a: "small" } }, "a", "b", true).kinds).toEqual(
      { b: "normal" },
    );
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
