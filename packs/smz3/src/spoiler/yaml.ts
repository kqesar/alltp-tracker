// The one module of the pack that imports js-yaml, so a page that never reads
// a samus.link spoiler log never downloads the parser: the app loads this
// module (through `parse.ts`) only when a player imports one.

import { accept, refuse, type SpoilerResult } from "@alltp/spoiler";
import { FAILSAFE_SCHEMA, load, YAMLException } from "js-yaml";

/**
 * samus.link's Download file as plain data.
 *
 * - **Failsafe schema**: only maps, sequences and strings. A name such as
 *   `Yes` or `1` is never read as a boolean or a number, and no tag can
 *   build anything else (a log is data, nothing in it constructs a value).
 *   The numbers of the Meta block are read by the caller, which knows their
 *   range.
 * - **No alias**: samus.link's writer never emits one, and an alias is how a
 *   small YAML file expands into a huge value. `maxAliases: 0` refuses it.
 * - A duplicate key is js-yaml's error, not a silent overwrite.
 *
 * The caller bounds the text (1 MiB, `checkSize`) before this reads it.
 * Never throws: a malformation is `not-a-spoiler`.
 */
export function readYaml(text: string): SpoilerResult<unknown> {
  try {
    return accept(load(text, { maxAliases: 0, schema: FAILSAFE_SCHEMA }));
  } catch (error) {
    // `reason` is js-yaml's own sentence ("duplicate mapping key"), never the
    // file's text
    const reason = error instanceof YAMLException ? `: ${error.reason}` : "";
    return refuse("not-a-spoiler", `invalid YAML${reason}`);
  }
}
