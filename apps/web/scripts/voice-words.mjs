#!/usr/bin/env node
// Says whether words are in the speech model's vocabulary, for the voice
// commands' phrases (src/games/alttpr/logic/voice.ts): a word the model lacks
// can never be heard, and Vosk drops the phrase that holds it.
//
//   pnpm --filter @alltp/web fetch-voice-model
//   node scripts/voice-words.mjs tri force try piece
//
// The model's archive has no words.txt: its words are the symbol table
// OpenFst keeps in graph/Gr.fst (152217 of them in vosk-model-small-en-us-0.15,
// "exp/chain_a/tdnn/lgraph/words.txt"): the magic 0x7eb2fb74, the table's name
// (an int32 length and its bytes), the next free key and the number of symbols
// (int64 each), then each symbol as an int32 length, its bytes and an int64
// key. Exits 1 when a word is missing.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

const MODEL = "vosk-model-small-en-us-0.15";
const archive = join(
  dirname(fileURLToPath(import.meta.url)),
  "../public/models",
  `${MODEL}.tar.gz`,
);

/** A file of a tar archive, by its path. */
const fileOf = (tar, path) => {
  for (let at = 0; at + 512 <= tar.length; ) {
    const name = tar.toString("latin1", at, at + 100).replace(/\0.*$/s, "");
    if (name === "") break;
    const size = Number.parseInt(
      tar.toString("latin1", at + 124, at + 136).trim() || "0",
      8,
    );
    if (name === path) return tar.subarray(at + 512, at + 512 + size);
    at += 512 + Math.ceil(size / 512) * 512;
  }
  throw new Error(`${path} is not in ${archive}`);
};

/** The words of the model's symbol table. */
const vocabulary = () => {
  const graph = fileOf(
    gunzipSync(readFileSync(archive)),
    `${MODEL}/graph/Gr.fst`,
  );
  const magic = Buffer.from([0x74, 0xfb, 0xb2, 0x7e]);
  let at = graph.indexOf(magic);
  if (at < 0) throw new Error("No symbol table in Gr.fst");
  at += 4;
  at += 4 + graph.readInt32LE(at); // the table's name
  at += 8; // the next free key
  const size = Number(graph.readBigInt64LE(at));
  at += 8;
  const words = new Set();
  for (let i = 0; i < size; i++) {
    const length = graph.readInt32LE(at);
    words.add(graph.toString("utf8", at + 4, at + 4 + length));
    at += 4 + length + 8;
  }
  return words;
};

const asked = process.argv.slice(2);
if (asked.length === 0) {
  console.error("usage: node scripts/voice-words.mjs <word>...");
  process.exit(2);
}
const words = vocabulary();
let missing = 0;
for (const word of asked) {
  const known = words.has(word);
  if (!known) missing++;
  console.log(`${known ? "in     " : "MISSING"} ${word}`);
}
process.exit(missing === 0 ? 0 : 1);
