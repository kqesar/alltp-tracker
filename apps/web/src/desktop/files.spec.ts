import { describe, expect, it, vi } from "vitest";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

const { saveOnDisk } = await import("@/desktop/files");

describe("a file the desktop app saves", () => {
  it("goes through the app's Save dialog, which says whether it was saved", async () => {
    invoke.mockResolvedValueOnce(true);
    expect(await saveOnDisk("run.json", "{}")).toBe(true);
    expect(invoke).toHaveBeenCalledWith("save_file", {
      contents: "{}",
      name: "run.json",
    });
    // The player cancelled
    invoke.mockResolvedValueOnce(false);
    expect(await saveOnDisk("run.json", "{}")).toBe(false);
  });

  it("is not saved when the app fails, which it says", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    invoke.mockRejectedValueOnce("Permission denied");
    expect(await saveOnDisk("run.json", "{}")).toBe(false);
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});
