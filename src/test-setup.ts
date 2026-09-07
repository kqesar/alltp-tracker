// The bare entrypoint only augments Jest's globals; vitest needs the /vitest
// one to pick up the matcher types on its own Assertion interface.
import "@testing-library/jest-dom/vitest";
