#!/usr/bin/env node
// Puts the speech model voice commands load beside the app, where the build
// copies it: public/models/vosk-model-small-en-us-0.15.tar.gz. It is not in
// git (40 MB): CI runs this before building, and so does a developer once.
//
//   node scripts/fetch-voice-model.mjs
//
// alphacephei.com publishes the model as a zip; vosk-browser reads a gzipped
// tar of the model's folder. The zip is checked against the SHA-256 pinned
// here before anything is unpacked, so the site serves exactly that model
// (Apache-2.0, https://alphacephei.com/vosk/models). Running it again with
// the model in place does nothing.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const MODEL = "vosk-model-small-en-us-0.15";
const URL = `https://alphacephei.com/vosk/models/${MODEL}.zip`;
const SHA256 =
  "30f26242c4eb449f948e42cb302dd7a686cb29a3423a8367f99ff41780942498";

const models = join(
  dirname(fileURLToPath(import.meta.url)),
  "../public/models",
);
const target = join(models, `${MODEL}.tar.gz`);
if (existsSync(target)) process.exit(0);

const response = await fetch(URL);
if (!response.ok) throw new Error(`${URL}: HTTP ${response.status}`);
const zip = Buffer.from(await response.arrayBuffer());
const digest = createHash("sha256").update(zip).digest("hex");
if (digest !== SHA256) {
  throw new Error(`${URL}: SHA-256 ${digest}, not the pinned ${SHA256}`);
}

const work = mkdtempSync(join(tmpdir(), "voice-model-"));
try {
  writeFileSync(join(work, "model.zip"), zip);
  execFileSync("unzip", ["-q", "model.zip"], { cwd: work });
  mkdirSync(models, { recursive: true });
  // The model's folder at the archive's root, as vosk-browser expects
  execFileSync("tar", ["-czf", target, MODEL], { cwd: work });
} finally {
  rmSync(work, { force: true, recursive: true });
}
console.log(`${target}: ${MODEL}`);
