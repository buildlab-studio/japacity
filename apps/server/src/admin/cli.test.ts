import { describe, expect, test } from "vitest";

import { rollbackCli } from "./cli";
import { life } from "./fixtures";

const SAVE = life("tunde-borrower");
const read = (text: string) => () => Promise.resolve(text);

describe("the rollback command line", () => {
  test("[R-SERVER-008] given a save in memory, when the check is run for it, then it reports no difference and exits 0", async () => {
    const result = await rollbackCli(["check", "character.tunde", "--memory", "save.json"], read(JSON.stringify(SAVE)));
    expect(result.exit).toBe(0);
    expect(JSON.parse(result.lines[0] ?? "")).toMatchObject({ ok: true, report: { character: "character.tunde", firstDiff: null, replayed: SAVE.commands.length } });
  });

  test("[R-SERVER-009] given a stored client save around the save, when apply is run, then there is nothing to correct and the tool says nothing left the process", async () => {
    const result = await rollbackCli(["apply", "character.tunde", "--memory", "save.json"], read(JSON.stringify({ save: SAVE, clock: { anchor: 0 } })));
    expect(result.exit).toBe(0);
    expect(JSON.parse(result.lines[0] ?? "")).toMatchObject({ ok: true, corrected: false });
    expect(result.lines).toHaveLength(2);
  });

  test("[R-SERVER-008] given no character, or no memory save while packages/db does not exist, when the tool is run, then it prints its usage and exits 2", async () => {
    for (const args of [["check"], ["fix", "character.tunde"], ["apply", "character.tunde"]]) {
      expect((await rollbackCli(args, read(""))).exit).toBe(2);
    }
  });
});
