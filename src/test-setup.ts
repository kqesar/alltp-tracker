// The bare entrypoint only augments Jest's globals; vitest needs the /vitest
// one to pick up the matcher types on its own Assertion interface.
import "@testing-library/jest-dom/vitest";

// jsdom has <dialog> but none of its methods. Model what the app relies on:
// showModal() and close() toggle the `open` attribute, which decides whether
// the dialog is rendered (and so visible to role queries).
if (typeof HTMLDialogElement.prototype.showModal !== "function") {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
  };
}
