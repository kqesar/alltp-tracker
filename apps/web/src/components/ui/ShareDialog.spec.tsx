import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ShareDialog } from "@/components/ui/ShareDialog";
import type { ShareResult } from "@/share/shareRun";

const LINK = { fallback: false, url: "https://example.test/#run=abc" };
const COPIED =
  "Link copied. The run stays in the link, never sent to a server.";

describe("ShareDialog", () => {
  const writeText = vi.fn<(text: string) => Promise<void>>();
  const onClose = vi.fn();

  beforeEach(() => {
    writeText.mockReset().mockResolvedValue();
    onClose.mockReset();
    vi.stubGlobal("navigator", { clipboard: { writeText } });
  });
  afterEach(() => vi.unstubAllGlobals());

  const open = (result: ShareResult | Promise<ShareResult>) =>
    render(<ShareDialog onClose={onClose} share={Promise.resolve(result)} />);

  it("stays closed with no share", () => {
    render(<ShareDialog onClose={onClose} share={null} />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("says it is copying, then how it went, and shows the QR code", async () => {
    let finish: (result: ShareResult) => void = () => {};
    open(new Promise<ShareResult>((resolve) => (finish = resolve)));

    expect(
      screen.getByRole("dialog", { name: "Share this run" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Copying…");
    // Named after what it copies: the desktop app adds a live link under it
    expect(screen.getByTestId("share-copy-again")).toHaveAccessibleName(
      "Copy the snapshot link",
    );
    expect(screen.getByTestId("share-copy-again")).toBeDisabled();
    expect(screen.queryByTestId("share-qr")).not.toBeInTheDocument();

    finish({ link: LINK, message: COPIED });

    expect(await screen.findByTestId("share-qr")).toHaveAccessibleName(
      "QR code of the link to this run",
    );
    expect(screen.getByRole("status")).toHaveTextContent(COPIED);
    expect(screen.getByText(/does not follow the game/)).toBeInTheDocument();
  });

  it("copies the link again from its button and reports it", async () => {
    open({ link: LINK, message: COPIED });
    await screen.findByTestId("share-qr");
    writeText.mockRejectedValueOnce(new DOMException("no", "NotAllowedError"));

    fireEvent.click(screen.getByTestId("share-copy-again"));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "refused the clipboard",
      ),
    );
    expect(writeText).toHaveBeenCalledWith(LINK.url);

    fireEvent.click(screen.getByTestId("share-copy-again"));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(/^Link copied\./),
    );
  });

  it("still shows the QR code when the clipboard refused", async () => {
    open({
      link: LINK,
      message:
        "The link could not be copied: this browser refused the clipboard.",
    });

    expect(await screen.findByTestId("share-qr")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("refused");
  });

  it("shows only the reason when no link could be made", async () => {
    open({
      link: null,
      message: "This browser cannot turn a run into a link.",
    });

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("cannot turn"),
    );
    expect(screen.queryByTestId("share-qr")).not.toBeInTheDocument();
    expect(screen.getByTestId("share-copy-again")).toBeDisabled();
  });

  it("says a link too long for a QR code cannot be drawn", async () => {
    open({
      link: {
        fallback: false,
        url: `https://example.test/#run=${"a".repeat(3000)}`,
      },
      message:
        "Link copied, but long (3000 characters): some chat apps will cut it.",
    });

    expect(await screen.findByTestId("share-qr-none")).toBeInTheDocument();
    expect(screen.queryByTestId("share-qr")).not.toBeInTheDocument();
  });

  it("closes on Escape and on the close button", async () => {
    open({ link: LINK, message: COPIED });
    await screen.findByTestId("share-qr");

    fireEvent(
      screen.getByRole("dialog"),
      new Event("cancel", { cancelable: true }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));

    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("shows no link in a race, whatever was made, and its Copy button is off but described", async () => {
    render(
      <ShareDialog
        onClose={onClose}
        race
        share={Promise.resolve({ link: LINK, message: COPIED })}
      />,
    );

    expect(await screen.findByRole("status")).toHaveTextContent(
      /^No link to the run is made while Race Mode is on/,
    );
    expect(screen.queryByTestId("share-qr")).not.toBeInTheDocument();
    const copy = screen.getByTestId("share-copy-again");
    expect(copy).toHaveAttribute("aria-disabled", "true");
    expect(copy).toHaveAccessibleDescription(/^No link to the run is made/);
    fireEvent.click(copy);
    expect(writeText).not.toHaveBeenCalled();
  });

  it("keeps the focus on Copy when Race Mode comes on under it", async () => {
    const share = Promise.resolve({ link: LINK, message: COPIED });
    const { rerender } = render(
      <ShareDialog onClose={onClose} share={share} />,
    );
    await screen.findByTestId("share-qr");
    const copy = screen.getByTestId("share-copy-again");
    copy.focus();
    expect(copy).toHaveFocus();

    rerender(<ShareDialog onClose={onClose} race share={share} />);

    expect(screen.queryByTestId("share-qr")).not.toBeInTheDocument();
    expect(screen.getByTestId("share-copy-again")).toBe(copy);
    expect(copy).toHaveFocus();
  });
});
