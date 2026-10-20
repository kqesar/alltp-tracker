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

// No unit test reaches the network: alttpr.com's seed files are asked for
// with a stub (vi.stubGlobal), which vi.unstubAllGlobals sets back to this.
globalThis.fetch = async () => {
  throw new TypeError("No network in unit tests");
};

// A run's link is compressed by the browser's own streams, which jsdom's
// window lacks in a vm context (the web project's pool): Node's are the same
// API. The specifier is a variable, since the app's types know no Node.
if (typeof CompressionStream === "undefined") {
  const specifier = "node:stream/web";
  const streams = await import(/* @vite-ignore */ specifier);
  Object.assign(globalThis, {
    CompressionStream: streams.CompressionStream,
    DecompressionStream: streams.DecompressionStream,
  });
}
