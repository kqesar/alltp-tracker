import {
  AutotrackSession,
  type DeviceDescriptor,
  type DeviceInfo,
  type PlannedRequest,
  type RaceSetting,
  type SessionStatus,
  type Transport,
  USB2SNES_LIMITS,
} from "@alltp/autotrack";
import { describe, expect, it } from "vitest";
import { writeSeedSettings } from "../../test/seed-rom";
import { CHECK_FLAGS } from "./check-flags";
import {
  decodeChecks,
  decodeItems,
  decodeProgress,
  racePermitted,
} from "./decode";
import { MEMORY_RANGES } from "./memory";
import { ALTTPR_AUTOTRACK } from "./pack";
import { decodePrizes } from "./prizes";
import { decodeSeedSettings } from "./seed-settings";

// A console behind a usb2snes bridge, in FX Pak Pro space: ROM from $00_0000
// (LoROM, headerless), WRAM from $F5_0000. The transport records every piece
// it is asked for.
const ROM_HEADER = 0x00_7fc0;
const RACE_FLAG = 0x18_0213;
const WRAM = 0xf5_0000;
const SAVE = (offset: number) => WRAM + 0xf000 + offset;

const DEVICE: DeviceDescriptor = {
  id: "ra://127.0.0.1:55355",
  kind: "retroarch",
};
const INFO: DeviceInfo = {
  device: DEVICE,
  flags: [],
  name: "retroarch",
  rom: "alttpr",
  romReadable: true,
  version: "1.22.2",
};

class Console implements Transport {
  readonly limits = USB2SNES_LIMITS;
  readonly pieces: [number, number][] = [];
  readonly memory = new Uint8Array(0x100_0000);

  open = () =>
    Promise.resolve({
      kind: "sni" as const,
      url: "ws://localhost:23074",
      version: "0.0.103",
    });
  listDevices = () => Promise.resolve([DEVICE]);
  attach = () => Promise.resolve(INFO);
  onClose(): void {}
  close(): void {}

  async read(request: PlannedRequest, into: Uint8Array, offset: number) {
    let at = offset;
    for (let i = 0; i < request.pieces.length; i += 2) {
      const address = request.pieces[i];
      const size = request.pieces[i + 1];
      this.pieces.push([address, size]);
      into.set(this.memory.subarray(address, address + size), at);
      at += size;
    }
  }

  /** Writes the header of an alttpr.com seed and its race flag pair. */
  seed(title: string, flag: readonly [number, number] | null): this {
    for (let i = 0; i < 21; i++) {
      this.memory[ROM_HEADER + i] = title.charCodeAt(i) || 0x20;
    }
    if (flag !== null) this.memory.set(flag, RACE_FLAG);
    return this;
  }

  /** A run in progress: a few items and checks, in play on the overworld. */
  play(): this {
    this.memory[WRAM + 0x10] = 0x09; // game mode: overworld
    this.memory[SAVE(0x359)] = 0x02; // Master Sword
    this.memory[SAVE(0x35c)] = 0x02; // one empty bottle
    this.memory[SAVE(0x374)] = 0x04; // the pendant of courage
    this.memory[SAVE(0x3c5)] = 0x02; // Zelda rescued
    this.memory[SAVE(0x208)] = 0x10; // Link's House chest (room $104)
    this.memory[SAVE(0x150)] = 0x10; // Eastern Palace compass chest (room $A8)
    this.memory[SAVE(0x191)] = 0x08; // Armos Knights (room $C8, boss bit)
    return this;
  }
}

const quiet = {
  query: () =>
    Promise.resolve({ name: "loopback-network", state: "granted" as const }),
  subscribe: () => () => {},
};
const visible = { hidden: () => false, subscribe: () => () => {} };

/** Starts a session on `console`; settles on its first verdict. */
function attach(console: Console, raceSetting: RaceSetting = "auto") {
  const session = new AutotrackSession({
    pack: ALTTPR_AUTOTRACK,
    permission: quiet,
    raceSetting,
    random: () => 0,
    transport: () => console,
    visibility: visible,
  });
  return new Promise<{
    status: SessionStatus;
    decoded: ReturnType<typeof decodeAll> | null;
  }>((resolve) => {
    session.subscribe((status) => {
      if (
        !["connected", "game-mismatch", "memory-unreadable"].includes(
          status.code,
        )
      ) {
        return;
      }
      const snapshot = session.snapshot;
      const race = session.race?.active ?? true;
      const decoded = snapshot === null ? null : decodeAll(snapshot, race);
      session.stop();
      resolve({ decoded, status });
    });
    session.start();
  });
}

function decodeAll(
  snapshot: NonNullable<AutotrackSession["snapshot"]>,
  race: boolean,
) {
  return {
    checks: decodeChecks(snapshot, { race }),
    items: decodeItems(snapshot, { race }),
    prizes: decodePrizes(snapshot, { race }),
    progress: decodeProgress(snapshot, { race }),
    race,
    seed: decodeSeedSettings(snapshot, { race }),
  };
}

/**
 * The forbidden ranges the console was asked for a byte of, outside the
 * bytes a permitted range shares with them (a boss room inside the dungeon
 * rooms): the race guard's rule.
 */
function readForbidden(console: Console): string[] {
  const permitted = (at: number) =>
    MEMORY_RANGES.some(
      (range) =>
        racePermitted(range.id) &&
        range.address <= at &&
        at < range.address + range.size,
    );
  return MEMORY_RANGES.filter((range) => !racePermitted(range.id))
    .filter((range) =>
      console.pieces.some(([address, size]) => {
        for (let at = address; at < address + size; at++) {
          const inside = at >= range.address && at < range.address + range.size;
          if (inside && !permitted(at)) return true;
        }
        return false;
      }),
    )
    .map((range) => range.id);
}

describe("ALTTPR_AUTOTRACK", () => {
  it("declares the map, the game check and the two-byte race flag", () => {
    expect(ALTTPR_AUTOTRACK.ranges).toBe(MEMORY_RANGES);
    expect(ALTTPR_AUTOTRACK.raceFlag).toMatchObject({
      address: RACE_FLAG,
      size: 2,
    });
    expect(ALTTPR_AUTOTRACK.gameCheck?.ranges).toEqual([0]);
    expect(ALTTPR_AUTOTRACK.tickMs).toBe(500);
  });

  it("tracks a race seed in Race Mode, never reading a forbidden byte", async () => {
    const console = new Console().seed("VT RACE", [0x01, 0x00]).play();
    const { decoded, status } = await attach(console);
    expect(status).toMatchObject({
      code: "connected",
      race: { active: true, flag: "race" },
    });
    expect(readForbidden(console)).toEqual([]);
    expect(decoded?.items.counts).toMatchObject({ rescueZelda: 1, sword: 2 });
    expect(decoded?.items.unsettled).toMatchObject({
      bottle: "race-mode",
      pendantOfCourage: "race-mode",
    });
    expect([...(decoded?.checks.checked ?? [])]).toEqual(["links-house"]);
    expect(decoded?.checks.unsettled.get("eastern-palace/compass-chest")).toBe(
      "race-mode",
    );
    expect(decoded?.progress.bosses.P1).toBe(true);
  });

  it("tracks an open seed fully", async () => {
    const console = new Console().seed("VT OPEN", [0x00, 0x01]).play();
    const { decoded, status } = await attach(console);
    expect(status).toMatchObject({
      code: "connected",
      race: { active: false, flag: "open" },
    });
    expect(readForbidden(console).length).toBeGreaterThan(0);
    expect(decoded?.items.counts).toMatchObject({
      bottle: 1,
      pendantOfCourage: 1,
    });
    expect([...(decoded?.checks.checked ?? [])].sort()).toEqual([
      "eastern-palace/boss",
      "eastern-palace/compass-chest",
      "links-house",
      "zelda",
    ]);
    expect(decoded?.checks.unsettled.size).toBe(0);
    expect(CHECK_FLAGS.length).toBeGreaterThan(4);
  });

  it("reads a seed's settings outside Race Mode only", async () => {
    const race = new Console().seed("VT RACE", [0x01, 0x00]).play();
    writeSeedSettings(race.memory, { dungeonItems: "full" });
    const raced = await attach(race);
    expect(readForbidden(race)).toEqual([]);
    expect(raced.decoded?.seed).toMatchObject({
      goal: { known: false, why: "race-mode" },
      logic: { known: true, value: "NoGlitches" },
      mode: { known: false, why: "race-mode" },
      seed: "RACE",
      wildKeys: { known: false, why: "race-mode" },
    });

    const open = new Console().seed("VT OPEN", [0x00, 0x01]).play();
    writeSeedSettings(open.memory, { dungeonItems: "full" });
    const opened = await attach(open);
    expect(readForbidden(open)).toContain("dungeon-item-menu");
    expect(opened.decoded?.seed).toMatchObject({
      crystalsTower: { known: true, value: 7 },
      goal: { known: true, value: "ganon" },
      mode: { known: true, value: "open" },
      seed: "OPEN",
      wildKeys: { known: true, value: true },
    });
  });

  it("keeps Race Mode on when the race flag reads as zero fill", async () => {
    // The header is readable, bank $30 is not: both flag bytes read $00, as
    // SNI fills a read RetroArch refused. A lone flag byte would say "open".
    const console = new Console().seed("VT UNREADABLE", null).play();
    const { status } = await attach(console);
    expect(status).toMatchObject({
      code: "connected",
      race: { active: true, flag: "unknown" },
    });
    expect(readForbidden(console)).toEqual([]);
  });

  it("never asks for a prize table in Race Mode, by the ROM's flag or set always on", async () => {
    const PRIZE_RANGES = [
      "prize-bits",
      "prize-kinds",
      "map-mode",
      "current-world",
      "map-overlay",
    ] as const;
    /** The prize ranges the console was asked for a byte of. */
    const asked = (console: Console) =>
      PRIZE_RANGES.filter((id) => {
        const { address, size } = MEMORY_RANGES.find(
          (range) => range.id === id,
        ) as (typeof MEMORY_RANGES)[number];
        return console.pieces.some(
          ([at, length]) => at < address + size && address < at + length,
        );
      });
    const withPrizes = (console: Console) => {
      const at = (id: (typeof PRIZE_RANGES)[number]) =>
        (MEMORY_RANGES.find((range) => range.id === id) as { address: number })
          .address;
      // Eastern Palace's prize: the Pendant of Courage, finished
      console.memory[at("prize-bits")] = 0x04;
      console.memory[at("prize-kinds")] = 0x00;
      console.memory[SAVE(0x473)] = 0x20;
      return console;
    };

    const raced = withPrizes(
      new Console().seed("VT RACE", [0x01, 0x00]).play(),
    );
    const race = await attach(raced);
    expect(race.status).toMatchObject({ race: { active: true, flag: "race" } });
    expect(asked(raced)).toEqual([]);

    const forced = withPrizes(
      new Console().seed("VT OPEN", [0x00, 0x01]).play(),
    );
    const always = await attach(forced, "on");
    expect(always.status).toMatchObject({
      race: { active: true, flag: "open" },
    });
    expect(asked(forced)).toEqual([]);

    // The same open seed outside Race Mode: every one of them is read
    const open = withPrizes(new Console().seed("VT OPEN", [0x00, 0x01]).play());
    const casual = await attach(open);
    expect(casual.status).toMatchObject({ race: { active: false } });
    expect(asked(open)).toEqual([...PRIZE_RANGES]);
    expect(casual.decoded?.prizes).toEqual({
      P1: { prize: "greenPendant", shownBy: "finished" },
    });
    expect(race.decoded?.prizes).toBe("race-mode");
    expect(always.decoded?.prizes).toBe("race-mode");
  });

  it("refuses the original game", async () => {
    const console = new Console().seed("THE LEGEND OF ZELDA", [0x00, 0x00]);
    console.memory[ROM_HEADER + 0x17] = 0x0a;
    const { status } = await attach(console);
    expect(status).toMatchObject({
      check: { code: "vanilla-alttp" },
      code: "game-mismatch",
    });
  });
});
