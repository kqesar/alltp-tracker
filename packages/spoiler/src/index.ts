export {
  type Binding,
  bindSeed,
  type Evidence,
  type Fact,
  type FactValue,
} from "./bind";
export {
  type CompareInput,
  type Comparison,
  compareRun,
  type Entry,
  type Find,
  type Whether,
} from "./compare";
export {
  checkSize,
  MAX_SLICE_DEPTH,
  MAX_SPOILER_BYTES,
  SNIFF_HEAD_LENGTH,
} from "./limits";
export type {
  Placement,
  SpoilerFormat,
  SpoilerGame,
  SpoilerLog,
} from "./model";
export {
  accept,
  MAX_DETAIL_LENGTH,
  type Refusal,
  refuse,
  type SpoilerError,
  type SpoilerResult,
} from "./result";
export { sliceTopLevel } from "./slice";
export { type Sniffed, sniffSpoiler } from "./sniff";
