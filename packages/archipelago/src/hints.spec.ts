import { describe, expect, it } from "vitest";
import { fixture, packetsTo } from "../test/fixtures";
import {
  clientStatusKey,
  clientStatusName,
  HINT_STATUS,
  type Hint,
  hintCost,
  hintStatus,
  hintsKey,
  parseClientStatusKey,
  parseHints,
  splitHints,
} from "./hints";

/** The last value the recorded tracker got for Link's hints. */
const recorded = (): unknown => {
  const replies = packetsTo(fixture("normal-session"), "tracker").filter(
    (p) => p.cmd === "SetReply" && p.key === hintsKey(0, 1),
  );
  return replies.at(-1)?.value;
};

const hint = (over: Partial<Hint>): Hint => ({
  entrance: "",
  finder: 1,
  flags: 1,
  found: false,
  item: 1,
  location: 1,
  receiver: 1,
  status: 0,
  ...over,
});

describe("hints", () => {
  it("reads the recorded hints, one found", () => {
    const hints = parseHints(recorded());
    expect(hints).toEqual([
      {
        entrance: "",
        finder: 1,
        flags: 1,
        found: false,
        item: 84007,
        location: 1310730,
        receiver: 3,
        status: 0,
      },
      {
        entrance: "",
        finder: 4,
        flags: 2,
        found: true,
        item: 23,
        location: 3,
        receiver: 1,
        status: 40,
      },
    ]);
    expect(hints?.map(hintStatus)).toEqual(["unspecified", "found"]);
  });

  it("splits the slot's hints: for it elsewhere, for others in its world", () => {
    const { forMe, inMyWorld } = splitHints(parseHints(recorded()) ?? [], 1);
    expect(forMe.map((h) => h.item)).toEqual([23]);
    expect(inMyWorld.map((h) => h.item)).toEqual([84007]);
  });

  it("names every 0.6 status, found first by its flag, and sorts most wanted first", () => {
    const all = [
      hint({ found: true, item: 1 }),
      hint({ item: 2, status: HINT_STATUS.avoid }),
      hint({ item: 3, status: HINT_STATUS.noPriority }),
      hint({ item: 4, status: HINT_STATUS.unspecified }),
      hint({ item: 5, status: HINT_STATUS.priority }),
      hint({ item: 6, status: 99 }),
      hint({ finder: 1, item: 7, receiver: 1 }),
    ];
    expect(all.map(hintStatus)).toEqual([
      "found",
      "avoid",
      "no-priority",
      "unspecified",
      "priority",
      "unspecified",
      "unspecified",
    ]);
    expect(splitHints(all, 1).forMe.map((h) => h.item)).toEqual([
      5, 4, 6, 7, 3, 2, 1,
    ]);
    expect(hintStatus({ found: false, status: HINT_STATUS.found })).toBe(
      "found",
    );
  });

  it.each([
    ["not a list", { a: 1 }],
    ["an entry that is not one", [null]],
    ["an entry without found", [{ ...hint({}), found: "no" }]],
    ["an entry of strings", [{ finding_player: "1" }]],
  ])("refuses %s", (_, value) => {
    expect(parseHints(value)).toBeNull();
  });

  it("reads a hint without a status (before 0.6) by found", () => {
    const old = {
      finding_player: 2,
      found: true,
      item: 3,
      location: 4,
      receiving_player: 1,
    };
    expect(parseHints([old])).toEqual([
      {
        entrance: "",
        finder: 2,
        flags: 0,
        found: true,
        item: 3,
        location: 4,
        receiver: 1,
        status: 40,
      },
    ]);
    expect(parseHints([{ ...old, found: false }])?.[0]?.status).toBe(0);
  });

  it("costs what MultiServer charges: a percentage of the slot's locations", () => {
    // The bench's room: hint_cost 10, Link has 249 locations
    expect(hintCost(10, 249)).toBe(24);
    expect(hintCost(1, 50)).toBe(1);
    expect(hintCost(0, 249)).toBe(0);
    expect(hintCost(null, 249)).toBeNull();
  });

  it("reads client status keys and names", () => {
    expect(clientStatusKey(0, 4)).toBe("_read_client_status_0_4");
    expect(parseClientStatusKey("_read_client_status_0_4")).toEqual({
      slot: 4,
      team: 0,
    });
    expect(parseClientStatusKey("_read_hints_0_4")).toBeNull();
    expect([0, 5, 10, 20, 30, 7].map(clientStatusName)).toEqual([
      "unknown",
      "connected",
      "ready",
      "playing",
      "goal",
      "unknown",
    ]);
  });
});
