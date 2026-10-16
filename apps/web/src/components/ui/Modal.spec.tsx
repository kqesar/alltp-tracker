import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Modal } from "@/components/ui/Modal";

/** Escape on a modal <dialog>: the browser fires a cancelable `cancel`. */
const pressEscapeOn = (dialog: HTMLElement) =>
  fireEvent(dialog, new Event("cancel", { cancelable: true }));

describe("Modal", () => {
  const renderModal = (isOpen: boolean, onClose = vi.fn()) =>
    render(
      <Modal isOpen={isOpen} onClose={onClose} title="Test dialog">
        <p>Body content</p>
      </Modal>,
    );

  it("draws a wide dialog only when asked", () => {
    const { rerender } = render(
      <Modal isOpen onClose={vi.fn()} title="Test dialog" wide>
        <p>Body content</p>
      </Modal>,
    );
    expect(screen.getByRole("dialog")).toHaveClass("modal", "modal--wide");

    rerender(
      <Modal isOpen onClose={vi.fn()} title="Test dialog">
        <p>Body content</p>
      </Modal>,
    );
    expect(screen.getByRole("dialog")).not.toHaveClass("modal--wide");
  });

  it("renders nothing when closed", () => {
    renderModal(false);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens a native dialog named by its title", () => {
    renderModal(true);
    const dialog = screen.getByRole("dialog");

    expect(dialog.tagName).toBe("DIALOG");
    expect(dialog).toHaveAttribute("open");
    expect(dialog).toHaveAccessibleName("Test dialog");
    expect(screen.getByText("Body content")).toBeInTheDocument();
  });

  it("calls onClose on Escape and keeps the dialog for React to close", () => {
    const onClose = vi.fn();
    renderModal(true, onClose);
    const cancel = new Event("cancel", { cancelable: true });

    fireEvent(screen.getByRole("dialog"), cancel);

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(cancel.defaultPrevented).toBe(true);
  });

  it("starts focus on the element marked data-autofocus", () => {
    render(
      <Modal isOpen onClose={() => {}} title="Test dialog">
        <button type="button">First</button>
        <button data-autofocus type="button">
          Safe choice
        </button>
      </Modal>,
    );

    expect(screen.getByRole("button", { name: "Safe choice" })).toHaveFocus();
  });

  it("calls onClose when the close button is clicked", () => {
    const onClose = vi.fn();
    renderModal(true, onClose);
    fireEvent.click(screen.getByLabelText("Close dialog"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose on a backdrop click but not on a click inside", () => {
    const onClose = vi.fn();
    renderModal(true, onClose);

    fireEvent.click(screen.getByText("Body content"));
    expect(onClose).not.toHaveBeenCalled();

    // A click on the backdrop targets the <dialog> element itself
    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes only the topmost of two stacked dialogs on Escape", () => {
    const closeList = vi.fn();
    const closeConfirm = vi.fn();
    render(
      <>
        <Modal isOpen onClose={closeList} title="List">
          <p>list</p>
        </Modal>
        <Modal isOpen onClose={closeConfirm} title="Confirm">
          <p>confirm</p>
        </Modal>
      </>,
    );

    pressEscapeOn(screen.getByRole("dialog", { name: "Confirm" }));

    expect(closeConfirm).toHaveBeenCalledTimes(1);
    expect(closeList).not.toHaveBeenCalled();
  });

  it("does not move focus when the parent re-renders with a new onClose", () => {
    const { rerender } = render(
      <Modal isOpen onClose={() => {}} title="Test dialog">
        <input aria-label="Name" />
      </Modal>,
    );
    const input = screen.getByLabelText("Name");
    input.focus();

    rerender(
      <Modal isOpen onClose={() => {}} title="Test dialog">
        <input aria-label="Name" />
      </Modal>,
    );

    expect(input).toHaveFocus();
  });

  it("gives focus back to the element that opened it", () => {
    const { rerender } = render(
      <>
        <button type="button">Open</button>
        <Modal isOpen={false} onClose={() => {}} title="Test dialog">
          <p>body</p>
        </Modal>
      </>,
    );
    const opener = screen.getByRole("button", { name: "Open" });
    opener.focus();

    rerender(
      <>
        <button type="button">Open</button>
        <Modal isOpen onClose={() => {}} title="Test dialog">
          <button type="button">Inside</button>
        </Modal>
      </>,
    );
    screen.getByRole("button", { name: "Inside" }).focus();

    rerender(
      <>
        <button type="button">Open</button>
        <Modal isOpen={false} onClose={() => {}} title="Test dialog">
          <p>body</p>
        </Modal>
      </>,
    );

    expect(opener).toHaveFocus();
  });
});
