import type { CheckView } from "@japacity/api";
import { CHECK_NAMES } from "@japacity/api";
import { time } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import type { AuthNotice } from "../auth/auth";
import { testDeps } from "../app.testing";
import { productionConfig } from "../config";
import type { ServerDeps } from "../dependencies";
import type { Report } from "../moderation/reports";
import { memoryReportQueue } from "../moderation/reports";
import { report } from "../moderation/moderation.testing";
import { noteDiverged, raiseAlarms } from "./alarm";
import type { CheckMail, CheckPorts } from "./checks";
import { CHECK_LIMIT, COUNTED_DAY_HOUR, countedDay, evaluateChecks, handleCheck, listChecks } from "./checks";

const { HOUR_MS, MINUTE_MS } = time;

/** A moment past the counted-day hour, so the counted day is the day that ended. */
const TODAY = time.utcDay(productionConfig.clock.epoch) + 10;
const NOW = time.dayStart(TODAY) + (COUNTED_DAY_HOUR + 1) * HOUR_MS;
const YESTERDAY = TODAY - 1;

function harness(seed: { reports?: Report[]; now?: number } = {}): { deps: ServerDeps; ports: CheckPorts; mail: CheckMail; notices: AuthNotice[]; emails: string[]; at: (ms: number) => void } {
  let now = seed.now ?? NOW;
  const deps = testDeps({ now: () => now });
  const ports: CheckPorts = { reports: memoryReportQueue({ reports: seed.reports ?? [] }) };
  const notices: AuthNotice[] = [];
  const emails = ["ada@example.com", "bisi@example.com"];
  const mail: CheckMail = {
    admins: () => Promise.resolve(emails),
    send: (notice) => {
      notices.push(notice);
      return Promise.resolve();
    },
    link: "https://japacity.test/admin",
  };
  return {
    deps,
    ports,
    mail,
    notices,
    emails,
    at: (ms) => {
      now = ms;
    },
  };
}

/** A counted day: the nightly job's one row that says the day was counted. */
async function counted(deps: ServerDeps, day: number): Promise<void> {
  await deps.stores.counters.add([{ day: time.dayName(day), region: "NG", name: "players/active", key: "NG", count: 12 }]);
}

const only = (views: readonly CheckView[], check: CheckView["check"]) => {
  const found = views.find((view) => view.check === check);
  if (found === undefined) throw new Error(`No check ${check}.`);
  return found;
};

describe("the checks", () => {
  test("[admin:checks-have-three-states] given nothing measured yet, when the checks are listed, then every check is there, in no-data state with no history, and what it found is measured live", async () => {
    const h = harness();
    const views = await listChecks(h.deps, h.ports);
    expect(views.map((view) => view.check)).toEqual([...CHECK_NAMES]);
    for (const view of views) expect(view).toMatchObject({ state: "no-data", since: null, history: [], limit: CHECK_LIMIT });
    expect(only(views, "nightly-counts")).toMatchObject({ value: 1, found: { kind: "day", day: time.dayName(YESTERDAY), counted: false } });
    expect(only(views, "asked-early").value).toBeNull();
    expect(only(views, "reports-overdue")).toMatchObject({ value: 0, found: { kind: "queue", overdue: 0 } });
  });

  test("[admin:checks-have-three-states] given the counted day is the day that ended only after the counted-day hour, when the clock is before and after it, then the day read moves", () => {
    expect(countedDay(time.dayStart(TODAY) + COUNTED_DAY_HOUR * HOUR_MS - 1)).toBe(TODAY - 2);
    expect(countedDay(time.dayStart(TODAY) + COUNTED_DAY_HOUR * HOUR_MS)).toBe(TODAY - 1);
  });

  test("[admin:checks-have-three-states] given a day counted with no early ask, suspects of that day and a draw alarm of another, when the checks are evaluated, then each is OK, in alarm or no-data by what it measures, and each change of state is one row of history with its time", async () => {
    const h = harness();
    await counted(h.deps, YESTERDAY);
    await raiseAlarms(h.deps, [
      { kind: "suspect", day: YESTERDAY, character: "character.a", reason: "salary", currency: "NGN", total: 2, ceiling: 1 },
      { kind: "suspect", day: YESTERDAY, character: "character.b", reason: "salary", currency: "NGN", total: 3, ceiling: 1 },
      { kind: "draw", day: YESTERDAY - 1, draw: 4, check: "win", total: 9, limit: 8 },
    ]);
    const views = await evaluateChecks(h.deps, h.ports, null);
    expect(only(views, "money-suspects")).toMatchObject({ state: "alarm", value: 2, since: NOW, history: [{ state: "alarm", value: 2, limit: CHECK_LIMIT, at: NOW }] });
    expect(only(views, "money-suspects").found).toMatchObject({ kind: "alarms", alarms: [{ character: "character.a" }, { character: "character.b" }] });
    expect(only(views, "draw-payouts")).toMatchObject({ state: "ok", value: 0, found: { kind: "alarms", alarms: [] } });
    expect(only(views, "diverged-lives")).toMatchObject({ state: "ok", value: 0 });
    expect(only(views, "asked-early")).toMatchObject({ state: "ok", value: 0, found: { kind: "asks", rows: [] } });
    expect(only(views, "nightly-counts")).toMatchObject({ state: "ok", value: 0, found: { kind: "day", counted: true } });
    expect(only(views, "reports-overdue")).toMatchObject({ state: "ok", value: 0 });

    // Evaluated again with nothing changed: no new row.
    h.at(NOW + 5 * MINUTE_MS);
    const again = await evaluateChecks(h.deps, h.ports, null);
    expect(only(again, "money-suspects")).toMatchObject({ since: NOW, history: [{ at: NOW }] });
    expect((await listChecks(h.deps, h.ports)).map((view) => view.history.length)).toEqual(CHECK_NAMES.map(() => 1));
  });

  test("[admin:checks-have-three-states] given a day with no counters at all, when asked-early is evaluated, then it is no-data; given the day counted with an ask before the early win, then it is in alarm with the counts by ask and day, regions added up", async () => {
    const h = harness();
    expect(only(await evaluateChecks(h.deps, h.ports, null), "asked-early")).toMatchObject({ state: "no-data", value: null });
    await counted(h.deps, YESTERDAY);
    await h.deps.stores.counters.add([
      { day: time.dayName(YESTERDAY), region: "NG", name: "ask/shown", key: "notify:before", count: 1 },
      { day: time.dayName(YESTERDAY), region: "GB", name: "ask/shown", key: "notify:before", count: 2 },
      { day: time.dayName(YESTERDAY), region: "NG", name: "ask/accepted", key: "sign-in:after", count: 50 },
    ]);
    h.at(NOW + 5 * MINUTE_MS);
    const view = only(await evaluateChecks(h.deps, h.ports, null), "asked-early");
    expect(view).toMatchObject({ state: "alarm", value: 3, found: { kind: "asks", rows: [{ day: time.dayName(YESTERDAY), name: "ask/shown", key: "notify:before", count: 3 }] } });
    expect(view.history.map((change) => change.state)).toEqual(["alarm", "no-data"]);
  });

  test("[admin:checks-have-three-states] [moderation:reports-decided-within-target] given an open report older than the target, when the checks are evaluated, then reports-overdue is in alarm with the queue's figures", async () => {
    const target = productionConfig.moderation.decideHours * HOUR_MS;
    const h = harness({ reports: [report("report.a", { at: NOW - target - 1 })] });
    expect(only(await evaluateChecks(h.deps, h.ports, null), "reports-overdue")).toMatchObject({ state: "alarm", value: 1, found: { kind: "queue", overdue: 1, oldest: target + 1, target } });
  });

  test("[admin:check-handled-with-reason] given diverged lives in alarm, when an admin marks the check handled with a reason, then it is OK from then with the admin and the reason in its history, a life that diverged later puts it back in alarm, and a check not in alarm cannot be handled", async () => {
    const h = harness();
    await noteDiverged(h.deps, "character.a", 7);
    expect(only(await evaluateChecks(h.deps, h.ports, null), "diverged-lives")).toMatchObject({ state: "alarm", value: 1 });

    h.at(NOW + 10 * MINUTE_MS);
    const handled = await handleCheck(h.deps, h.ports, "diverged-lives", "account.owner", "Replayed and rolled back.");
    expect(handled).toMatchObject({ ok: true, check: { state: "ok", value: 0, since: NOW + 10 * MINUTE_MS, history: [{ state: "ok", at: NOW + 10 * MINUTE_MS, admin: "account.owner", reason: "Replayed and rolled back." }, { state: "alarm" }] } });
    expect(await handleCheck(h.deps, h.ports, "diverged-lives", "account.owner", "Again.")).toEqual({ ok: false, code: "not-possible", detail: "diverged-lives is not in alarm." });

    h.at(NOW + 15 * MINUTE_MS);
    expect(only(await evaluateChecks(h.deps, h.ports, null), "diverged-lives")).toMatchObject({ state: "ok", value: 0 });
    h.at(NOW + 20 * MINUTE_MS);
    await noteDiverged(h.deps, "character.b", 3);
    const back = only(await evaluateChecks(h.deps, h.ports, null), "diverged-lives");
    expect(back).toMatchObject({ state: "alarm", value: 1, found: { kind: "alarms", alarms: [{ character: "character.b" }] } });
    expect(back.history.map((change) => change.state)).toEqual(["alarm", "ok", "alarm"]);
  });

  test("[admin:check-change-sends-email] given admins with verified emails, when a check goes into alarm, stays there, clears, and goes no-data, then one mail goes to each admin on the change into alarm and on the clear, and none otherwise", async () => {
    const h = harness();
    await counted(h.deps, YESTERDAY);
    await raiseAlarms(h.deps, [{ kind: "suspect", day: YESTERDAY, character: "character.a", reason: "salary", currency: "NGN", total: 2, ceiling: 1 }]);
    await evaluateChecks(h.deps, h.ports, h.mail);
    // Into alarm: money suspects. Nightly counts and the rest went OK from no state, which is no change into alarm.
    expect(h.notices).toEqual(
      h.emails.map((email) => ({ email, kind: "check-changed", at: NOW, check: "money-suspects", state: "alarm", value: "1", limit: String(CHECK_LIMIT), link: "https://japacity.test/admin" })),
    );

    h.at(NOW + 5 * MINUTE_MS);
    await evaluateChecks(h.deps, h.ports, h.mail);
    expect(h.notices).toHaveLength(2);

    // The next day: the counted day moves on, the suspects are of the day before, and the check clears.
    const next = NOW + time.DAY_MS;
    h.at(next);
    await counted(h.deps, YESTERDAY + 1);
    await evaluateChecks(h.deps, h.ports, h.mail);
    expect(h.notices.slice(2)).toEqual(h.emails.map((email) => ({ email, kind: "check-changed", at: next, check: "money-suspects", state: "ok", value: "0", limit: String(CHECK_LIMIT), link: "https://japacity.test/admin" })));

    // A day with no counters: asked-early goes no-data, nightly-counts goes into alarm. Only the alarm is mailed.
    const after = next + time.DAY_MS;
    h.at(after);
    await evaluateChecks(h.deps, h.ports, h.mail);
    expect(h.notices.slice(4).map((notice) => (notice.kind === "check-changed" ? [notice.check, notice.state] : notice.kind))).toEqual(h.emails.map(() => ["nightly-counts", "alarm"]));
  });

  test("[admin:check-change-sends-email] given no admin with a verified email, when a check goes into alarm, then nothing is sent and the change is still written", async () => {
    const h = harness();
    h.emails.length = 0;
    await noteDiverged(h.deps, "character.a", 1);
    expect(only(await evaluateChecks(h.deps, h.ports, h.mail), "diverged-lives")).toMatchObject({ state: "alarm", history: [{ state: "alarm" }] });
    expect(h.notices).toEqual([]);
  });

  test("[admin:check-handled-with-reason] [admin:check-change-sends-email] given a check marked handled, when the checks are next evaluated, then the clear is not mailed again and no row is added", async () => {
    const h = harness();
    await noteDiverged(h.deps, "character.a", 1);
    await evaluateChecks(h.deps, h.ports, h.mail);
    h.at(NOW + MINUTE_MS);
    await handleCheck(h.deps, h.ports, "diverged-lives", "account.owner", "Rolled back.");
    h.at(NOW + 2 * MINUTE_MS);
    const view = only(await evaluateChecks(h.deps, h.ports, h.mail), "diverged-lives");
    expect(view.history).toHaveLength(2);
    expect(h.notices.flatMap((notice) => (notice.kind === "check-changed" && notice.check === "diverged-lives" ? [notice.state] : []))).toEqual(h.emails.map(() => "alarm"));
  });
});
