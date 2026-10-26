// Records the dark room map's ranges from a running game, as a fixture for
// `src/autotrack/dark-room.spec.ts`: RetroArch (bsnes-mercury) with Network
// Commands on (port 55355), Link in the room to record, in normal play.
//
//   pnpm --filter @alltp/pack-alttpr record-dark-room test/dark-room/<name>.json "<what it is>"
//
// It takes the Lamp away ($7E:F34A = 0, the game's own bytes: this writes to
// the game's memory, so use a test save), reads each range with
// READ_CORE_MEMORY and writes them as hex under the memory map's ids. The
// spec holds the recording to the memory map (same ids, same sizes), so a
// range that moves needs this run again. A room loads dark by the game's own
// code: write the entrance's id to $7E:010E and the underworld load module,
// $06, to $7E:0010 (the Old Man's caves and the Secret Passage are
// entrances $2E-$32 of this seed's ROM, found by loading each).
// Never edit a recording by hand.

import { createSocket } from "node:dgram";
import { writeFileSync } from "node:fs";

/** The ranges of memory.ts that `dark-room.ts` reads, A-bus address and size. */
const RANGES = {
  "dark-room-chests": [0x7e_06e0, 0x20],
  "dark-room-dark": [0x7e_c005, 1],
  "dark-room-doors": [0x7e_1980, 0x20],
  "dark-room-indoors": [0x7e_001b, 1],
  "dark-room-layer": [0x7e_00ee, 1],
  "dark-room-lights": [0x7e_0458, 0x22],
  "dark-room-link": [0x7e_0020, 4],
  "dark-room-map": [0x7f_2000, 0x2000],
  "dark-room-mode": [0x7e_0010, 2],
  "dark-room-objects": [0x7e_0500, 0x60],
  "dark-room-room": [0x7e_00a0, 2],
  // The equipment that holds the Lamp
  "equipment-b": [0x7e_f344, 11],
};

const [file, description] = process.argv.slice(2);
if (!file || !description) {
  console.error("usage: record-dark-room <out.json> <description>");
  process.exit(2);
}

const socket = createSocket("udp4");
/**
 * @param {string} text
 * @returns {Promise<string>}
 */
const ask = (text) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`no answer to ${text}`)),
      2000,
    );
    socket.once("message", (message) => {
      clearTimeout(timer);
      resolve(message.toString().trim());
    });
    socket.send(text, 55355, "127.0.0.1");
  });

/**
 * `size` bytes at `address`, as hex, in the 2048-byte commands RetroArch serves.
 * @param {number} address
 * @param {number} size
 * @returns {Promise<string>}
 */
const read = async (address, size) => {
  /** @type {number[]} */
  const bytes = [];
  for (let at = 0; at < size; at += 2048) {
    const count = Math.min(2048, size - at);
    const reply = await ask(
      `READ_CORE_MEMORY ${(address + at).toString(16)} ${count}`,
    );
    const [, , ...values] = reply.split(" ");
    if (reply.includes("-1") || values.length !== count) {
      throw new Error(
        `could not read ${address.toString(16)}: ${reply.slice(0, 80)}`,
      );
    }
    bytes.push(
      ...values.map((/** @type {string} */ value) =>
        Number.parseInt(value, 16),
      ),
    );
  }
  return Buffer.from(bytes).toString("hex");
};

try {
  await ask("WRITE_CORE_MEMORY 7ef34a 00");
  await new Promise((resolve) => setTimeout(resolve, 300));
  /** @type {Record<string, string>} */
  const ranges = {};
  for (const [id, [address, size]] of Object.entries(RANGES)) {
    ranges[id] = await read(address, size);
  }
  writeFileSync(file, `${JSON.stringify({ description, ranges }, null, 1)}\n`);
  console.log(`wrote ${file}`);
} finally {
  socket.close();
}
