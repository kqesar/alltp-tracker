// upstream.json is the pin: the AP release and archipelago.js version the
// package, its fixtures and its name data were checked against.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { libraryVersion } from "archipelago.js";
import { describe, expect, it } from "vitest";
import { CLIENT_VERSION } from "../src/report";
import { ARCHIPELAGO_VERSION } from "../src/version";
import { dataPackage, type FixtureName, fixture } from "./fixtures";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (file: string) =>
  JSON.parse(readFileSync(join(root, file), "utf8"));
const upstream = read("upstream.json");
const pkg = read("package.json");

describe("upstream pin", () => {
  it("names the release the code says it was checked against", () => {
    expect(upstream.release).toBe(ARCHIPELAGO_VERSION);
    expect(upstream.commit).toMatch(/^[0-9a-f]{40}$/);
  });

  it("pins archipelago.js exactly, at the version recorded", () => {
    expect(pkg.dependencies["archipelago.js"]).toBe(
      upstream.archipelagoJs.version,
    );
    expect(libraryVersion).toBe(upstream.archipelagoJs.version);
    expect(CLIENT_VERSION).toBe(upstream.archipelagoJs.sends);
  });

  it("holds fixtures recorded against the pinned versions", () => {
    const names = readdirSync(join(root, "test/fixtures")).map((f) =>
      f.replace(/\.json$/, ""),
    );
    expect(names.length).toBe(9);
    for (const name of names) {
      const data = fixture(name as FixtureName);
      expect(data.archipelago, name).toBe(upstream.release);
      expect(data.archipelagoJs, name).toBe(upstream.archipelagoJs.version);
    }
  });

  it("holds the name data whose checksums it records", () => {
    for (const [game, checksum] of Object.entries(upstream.nameData)) {
      const body = dataPackage(game);
      expect(body.checksum, game).toBe(checksum);
      expect(body.archipelago, game).toBe(upstream.release);
    }
  });
});
