import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StreamViewControl } from "@/components/ui/StreamViewControl";
import { useGameStore } from "@/stores/gameStore";

/** jsdom has no Clipboard API: give the page one, or take it away. */
const setClipboard = (clipboard: Partial<Clipboard> | undefined) =>
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: clipboard,
  });

const obsUrl = `${window.location.origin}/?view=obs`;

const openDialog = () => {
  render(<StreamViewControl />);
  fireEvent.click(screen.getByTestId("stream-view-button"));
  return screen.getByRole("dialog", { name: "Stream view" });
};

describe("StreamViewControl", () => {
  beforeEach(() => {
    act(() => useGameStore.setState(useGameStore.getInitialState(), true));
  });

  afterEach(() => setClipboard(undefined));

  it("is a toolbar button named after the stream view", () => {
    render(<StreamViewControl />);

    const button = screen.getByTestId("stream-view-button");
    expect(button.tagName).toBe("BUTTON");
    expect(button).toHaveAccessibleName("Stream view");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens on the stream view's address, focus on Copy", () => {
    const dialog = openDialog();

    const url = within(dialog).getByLabelText("Browser source URL");
    expect(url).toBe(screen.getByTestId("stream-view-url"));
    expect(url).toHaveValue(obsUrl);
    expect(url).toHaveAttribute("readonly");
    expect(screen.getByTestId("stream-view-copy")).toHaveFocus();
  });

  it("selects the whole address when it takes focus", () => {
    openDialog();
    const url = screen.getByTestId("stream-view-url") as HTMLInputElement;

    fireEvent.focus(url);

    expect(url.selectionStart).toBe(0);
    expect(url.selectionEnd).toBe(obsUrl.length);
  });

  it("copies the address to the clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });
    openDialog();

    fireEvent.click(screen.getByTestId("stream-view-copy"));

    expect(writeText).toHaveBeenCalledWith(obsUrl);
    expect(await screen.findByText("Copied.")).toBe(
      screen.getByTestId("stream-view-status"),
    );
  });

  describe("without clipboard access", () => {
    const { execCommand } = document;
    afterEach(() => {
      document.execCommand = execCommand;
    });

    it("selects the address and copies it with the older command", async () => {
      setClipboard({
        writeText: vi.fn().mockRejectedValue(new Error("denied")),
      });
      const command = vi.fn(() => true);
      document.execCommand = command;
      openDialog();
      const url = screen.getByTestId("stream-view-url") as HTMLInputElement;

      fireEvent.click(screen.getByTestId("stream-view-copy"));

      await screen.findByText("Copied.");
      expect(command).toHaveBeenCalledWith("copy");
      expect(url.selectionStart).toBe(0);
      expect(url.selectionEnd).toBe(obsUrl.length);
    });

    it("leaves the address selected for Ctrl+C when nothing can copy", async () => {
      setClipboard(undefined);
      document.execCommand = vi.fn(() => false);
      openDialog();
      const url = screen.getByTestId("stream-view-url") as HTMLInputElement;

      fireEvent.click(screen.getByTestId("stream-view-copy"));

      expect(await screen.findByText("Press Ctrl+C to copy.")).toBe(
        screen.getByTestId("stream-view-status"),
      );
      expect(url.selectionStart).toBe(0);
      expect(url.selectionEnd).toBe(obsUrl.length);
    });
  });

  it("links to the view in a new tab", () => {
    openDialog();

    const link = screen.getByTestId("stream-view-open");
    expect(link).toHaveAccessibleName("Open in a new tab");
    expect(link).toHaveAttribute("href", obsUrl);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("recommends a source the grid fills at the icons' own size", () => {
    // Raw text: toHaveTextContent would fold the no-break spaces
    const dialog = openDialog();
    expect(dialog.textContent).toMatch(/512 × 384 for the crispest/);
    expect(dialog.textContent).toMatch(/or 1024 × 768\./);

    // The key cells add a row
    act(() => useGameStore.getState().setBigKeysVisible(true));
    expect(dialog.textContent).toMatch(/512 × 448 for the crispest/);
  });

  it("names the tracker's own address for the dock and the bg option", () => {
    const dialog = openDialog();

    expect(dialog).toHaveTextContent(`${window.location.origin}/`);
    expect(dialog).toHaveTextContent("&bg=00ff00");
  });

  it("closes on Done and forgets the copy status", async () => {
    setClipboard({ writeText: vi.fn().mockResolvedValue(undefined) });
    openDialog();
    fireEvent.click(screen.getByTestId("stream-view-copy"));
    await screen.findByText("Copied.");

    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByTestId("stream-view-button"));
    expect(screen.getByTestId("stream-view-status")).toHaveTextContent("");
  });
});
