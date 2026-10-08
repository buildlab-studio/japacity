import { afterEach, describe, expect, test, vi } from "vitest";

import { harness, makeJar } from "../auth/testing";
import { cleanArgs, cleanCli } from "./clean";

afterEach(() => {
  vi.useRealTimers();
});

const DAY_MS = 86_400_000;

describe("the guest clean-up tool", () => {
  test("[R-ACCOUNT-026] given guests last played either side of the idle days and an old secured account, when the tool lists and then applies, then only guests idle strictly longer are listed and removed, through the deletion's removal", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const start = Date.parse("2026-01-05T10:00:00Z");
    vi.setSystemTime(start);
    const h = harness();
    const idle = await h.guest(makeJar(), { username: "idle_one" });
    const secured = await h.signUp("ada@example.com");
    vi.setSystemTime(start + 1);
    const edge = await h.guest(makeJar(), { username: "edge_one" });
    const days = 90;
    vi.setSystemTime(start + 1 + days * DAY_MS);

    const listed = await cleanCli(h.deps, h.auth, ["--idle-days", String(days)]);
    expect(listed.exit).toBe(0);
    expect(listed.lines[0]).toContain(idle.account);
    expect(listed.lines.slice(1)).toEqual([`1 guest accounts with no play for ${String(days)} days.`, "Nothing removed: run again with --apply to remove them."]);
    expect(await h.deps.stores.account.get(idle.account)).not.toBeNull();

    const applied = await cleanCli(h.deps, h.auth, ["--idle-days", String(days), "--apply"]);
    expect(applied.lines.at(-1)).toBe("1 deletions completed.");
    expect(await h.deps.stores.account.get(idle.account)).toBeNull();
    expect(h.tables.user.map((row) => row["id"])).toEqual([secured.account, edge.account]);
    expect((await h.call("/api/account", { jar: idle.jar })).status).toBe(401);
    expect((await h.call("/api/account", { jar: edge.jar })).status).toBe(200);
    expect(await h.deps.stores.deletion.due(Number.MAX_SAFE_INTEGER)).toEqual([]);
  });

  test("[R-ACCOUNT-026] given the command line, when it is read, then the idle days default to the setting, take a whole number of at least 1, and anything else is refused", () => {
    expect(cleanArgs([], 90)).toEqual({ idleDays: 90, apply: false });
    expect(cleanArgs(["--apply", "--idle-days", "1"], 90)).toEqual({ idleDays: 1, apply: true });
    for (const bad of [["--idle-days"], ["--idle-days", "0"], ["--idle-days", "-3"], ["--idle-days", "2.5"], ["--days", "3"], ["apply"]]) expect(cleanArgs(bad, 90)).toBeNull();
  });
});
