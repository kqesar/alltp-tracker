import { describe, expect, it, vi } from "vitest";
import { FakeLocks } from "@/autotrack/fixtures";
import {
  AUTOTRACK_LOCK,
  createAutotrackLock,
  createTabLock,
} from "@/autotrack/lock";

describe("a tab lock", () => {
  it("is taken under its own name, by one holder at a time", async () => {
    const locks = new FakeLocks();
    const request = vi.spyOn(locks, "request");
    const manager = () => locks as unknown as LockManager;
    const first = createTabLock("alltp-tracker-archipelago", manager);
    const second = createTabLock("alltp-tracker-archipelago", manager);
    expect(
      await first.take(
        () => true,
        () => {},
      ),
    ).toBe(true);
    expect(request.mock.calls[0]?.[0]).toBe("alltp-tracker-archipelago");

    const waiting: boolean[] = [];
    const taken = second.take(
      () => true,
      (elsewhere) => waiting.push(elsewhere),
    );
    await vi.waitFor(() => expect(waiting).toEqual([true]));
    first.release();
    expect(await taken).toBe(true);
    expect(waiting).toEqual([true, false]);
    second.release();
  });

  it("goes ahead without Web Locks", async () => {
    expect(
      await createTabLock("x", () => undefined).take(
        () => true,
        () => {},
      ),
    ).toBe(true);
  });

  it("is autotracking's under the shared name", async () => {
    const locks = new FakeLocks();
    const request = vi.spyOn(locks, "request");
    const lock = createAutotrackLock(() => locks as unknown as LockManager);
    await lock.take(
      () => true,
      () => {},
    );
    expect(request.mock.calls[0]?.[0]).toBe(AUTOTRACK_LOCK);
    lock.release();
  });
});
