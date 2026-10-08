// `pnpm rollback check <character>` and `pnpm rollback apply <character>`
// (R-SERVER-008, R-SERVER-009). Against `DATABASE_URL` through packages/db
// once that package exists; until then `--memory <save.json>` stores the save
// as that character in the memory stores and runs the tool there, and an
// applied correction ends with the process.
import { content } from "@japacity/content";
import type { FlatSave, Save } from "@japacity/sim";
import { loadSave } from "@japacity/sim";

import { productionConfig } from "../config";
import { memoryStores } from "../deps";
import { storeSave } from "./memory";
import { rollbackApply, rollbackCheck } from "./rollback";

export interface CliResult {
  exit: number;
  lines: string[];
}

const USAGE = "Usage: pnpm rollback check|apply <character> --memory <save.json>";

/** A save in segments with one segment from its scenario, or a flat save, as the flat shape the memory loader stores. */
function flat(value: unknown): FlatSave | null {
  if (typeof value !== "object" || value === null) return null;
  const held = "save" in value ? value.save : value;
  const save = loadSave(held as Save | FlatSave);
  const only = save.segments.length === 1 ? save.segments[0] : undefined;
  if (only === undefined || "base" in only.start) return null;
  return { schema: 2, content: only.content, ...only.start, commands: only.commands };
}

export async function rollbackCli(args: readonly string[], read: (path: string) => Promise<string>): Promise<CliResult> {
  const [action, character, flag, path] = args;
  if ((action !== "check" && action !== "apply") || character === undefined) return { exit: 2, lines: [USAGE] };
  if (flag !== "--memory" || path === undefined) {
    return { exit: 2, lines: ["packages/db does not exist yet, so the tool runs only on a save in memory.", USAGE] };
  }
  const save = flat(JSON.parse(await read(path)));
  if (save === null) return { exit: 2, lines: [`${path} holds no save that starts from its scenario in one segment.`] };
  const deps = { config: productionConfig, contents: { current: content, previous: null }, stores: memoryStores(), now: () => Date.now() };
  await storeSave(deps, character, save);
  const result = action === "check" ? await rollbackCheck(deps, character) : await rollbackApply(deps, character);
  const lines = [JSON.stringify(result, null, 2)];
  if (action === "apply") lines.push("The memory store ends with this process: nothing was written anywhere else.");
  return { exit: result.ok ? 0 : 1, lines };
}
