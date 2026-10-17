// `pnpm rollback check <character>` and `pnpm rollback apply <character>`
// (R-SERVER-008, R-SERVER-009, R-SERVER-047). With no flag it runs
// on the game's database through packages/db, on the string in
// `DATABASE_URL_UNPOOLED`, one character per run (R-SERVER-010);
// `--memory <save.json>` stores the save as that character in the memory
// stores and runs the tool there, and an applied correction ends with the process.
import { content } from "@japacity/content";
import type { FlatSave, Save } from "@japacity/sim";
import { loadSave } from "@japacity/sim";

import { productionConfig } from "../config";
import { memoryStores } from "../deps";
import type { OpenDatabase } from "./database";
import { DATABASE_ENV } from "./database";
import { storeSave } from "./memory";
import { rollbackApply, rollbackCheck } from "./rollback";

export interface CliResult {
  exit: number;
  lines: string[];
}

const USAGE = `Usage: pnpm rollback check|apply <character> (on the database at ${DATABASE_ENV}), or pnpm rollback check|apply <character> --memory <save.json>`;

/** A save in segments with one segment from its scenario, or a flat save, as the flat shape the memory loader stores. */
function flat(value: unknown): FlatSave | null {
  if (typeof value !== "object" || value === null) return null;
  const held = "save" in value ? value.save : value;
  const save = loadSave(held as Save | FlatSave);
  const only = save.segments.length === 1 ? save.segments[0] : undefined;
  if (only === undefined || "base" in only.start) return null;
  return { schema: 2, content: only.content, ...only.start, commands: only.commands };
}

/** R-SERVER-008, R-SERVER-009: the check or the correction of one character on the database `open` reaches. */
async function onDatabase(action: "check" | "apply", character: string, open: OpenDatabase): Promise<CliResult> {
  if (open === null) return { exit: 2, lines: [`Set ${DATABASE_ENV} to the game's database first (the migrator's string, as the migration step uses).`, USAGE] };
  const { deps, close } = await open();
  try {
    const result = action === "check" ? await rollbackCheck(deps, character) : await rollbackApply(deps, character);
    return { exit: result.ok ? 0 : 1, lines: [JSON.stringify(result, null, 2)] };
  } finally {
    await close();
  }
}

/** `open` reaches the database named by `DATABASE_URL_UNPOOLED`, or is null when it is not set. */
export async function rollbackCli(args: readonly string[], read: (path: string) => Promise<string>, open: OpenDatabase = null): Promise<CliResult> {
  const [action, character, flag, path, ...rest] = args;
  if ((action !== "check" && action !== "apply") || character === undefined || rest.length > 0) return { exit: 2, lines: [USAGE] };
  if (flag === undefined) return onDatabase(action, character, open);
  if (flag !== "--memory" || path === undefined) return { exit: 2, lines: [USAGE] };
  const save = flat(JSON.parse(await read(path)));
  if (save === null) return { exit: 2, lines: [`${path} holds no save that starts from its scenario in one segment.`] };
  const deps = { config: productionConfig, contents: { current: content, previous: null }, stores: memoryStores(), now: () => Date.now() };
  await storeSave(deps, character, save);
  const result = action === "check" ? await rollbackCheck(deps, character) : await rollbackApply(deps, character);
  const lines = [JSON.stringify(result, null, 2)];
  if (action === "apply") lines.push("The memory store ends with this process: nothing was written anywhere else.");
  return { exit: result.ok ? 0 : 1, lines };
}
