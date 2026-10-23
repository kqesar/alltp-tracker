// Public entry point of @alltp/engine. The app's no-barrel rule covers src/
// of the app; a package needs one stable surface, and this is it.
export {
  type Analysis,
  type AnalyzeOptions,
  type Atom,
  analyze,
  type Blockers,
  MAX_SETS,
} from "./analyze";
export {
  type AndExpr,
  type ConstExpr,
  type CountExpr,
  type Expr,
  type HelperExpr,
  IDENTIFIER,
  type ItemExpr,
  isIdentifier,
  type MaybeExpr,
  type OrExpr,
  RESERVED_WORDS,
  type ReachExpr,
  type SettingExpr,
  type SettingThreshold,
  type Threshold,
  walk,
} from "./ast";
export {
  type EvaluateOptions,
  evaluate,
  itemValue,
  type State,
  type TraceNode,
  trace,
} from "./evaluate";
export { type Explanation, explain, type PathStep } from "./explain";
export { locationId } from "./ids";
export { ParseError, parse } from "./parser";
export { print } from "./printer";
export {
  DefinitionError,
  loadRules,
  NO_RULES,
  type Rules,
  type RulesSource,
} from "./rules";
export { foldSettings, type Settings, type UnknownSetting } from "./settings";
export { Solution, solve } from "./solve";
export {
  and,
  compare,
  fromRank,
  type Level,
  MAYBE,
  NO,
  or,
  rank,
  soften,
  TRI_VALUES,
  type Tri,
  YES,
} from "./tri";
export {
  type CompiledWorld,
  type CompileOptions,
  compileWorld,
  type Exit,
  type Location,
  type Region,
  type Visibility,
  type World,
} from "./world";
