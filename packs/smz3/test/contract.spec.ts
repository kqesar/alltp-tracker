import { describe, expect, it } from "vitest";
import { type Breach, breaches, type Subject } from "./contract";
import { FIXTURE_NAMES, loadFixture } from "./fixtures";
import { PACK } from "./pack-subject";

/**
 * Upstream's cases its logic has outrun. Commit 3dc171c (2022-04-29) added
 * `&& (items.Gravity || items.Ice || items.HiJump && items.SpringBall)` to
 * yellow Maridia's three rules (Maridia/Inner.cs:15-26), after the tests'
 * last change (2022-02-18): a case without them reaches in the tests but
 * not in the logic samus.link runs, which upstream's CI never checks (it
 * only publishes). The pack follows the logic.
 */
const STALE = new Set([
  "Super Missile (yellow Maridia)",
  "Missile (yellow Maridia super missile)",
  "Missile (yellow Maridia false wall)",
]);

/** Whether the clause 3dc171c added holds for a case's items. */
const yellowMaridiaClause = ({ items }: Breach) =>
  (items.Gravity ?? 0) > 0 ||
  (items.Ice ?? 0) > 0 ||
  ((items.HiJump ?? 0) > 0 && (items.SpringBall ?? 0) > 0);

describe.each(FIXTURE_NAMES)("upstream's %s logic tests", (name) => {
  const { cases, header } = loadFixture(name);
  const found = breaches(header, cases, PACK);

  it("hold: every case reaches, and none once one of it is skipped", () => {
    expect(found.filter((b) => !STALE.has(b.name))).toEqual([]);
  });

  it("break only where the logic outran them, as the logic has it", () => {
    const stale = found.filter((b) => STALE.has(b.name));
    expect(stale.length).toBeGreaterThan(0);
    for (const breach of stale) {
      expect(breach).toMatchObject({ expected: true, got: "no" });
      expect(yellowMaridiaClause(breach)).toBe(false);
    }
  });

  it("would catch a subject that says maybe, or yes, to everything", () => {
    const maybe: Subject = () => "maybe";
    const yes: Subject = () => "yes";
    expect(breaches(header, cases, maybe).length).toBeGreaterThan(0);
    expect(breaches(header, cases, yes).length).toBeGreaterThan(0);
  });
});
