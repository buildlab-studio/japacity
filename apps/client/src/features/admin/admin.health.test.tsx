// Health (admin:sections-alarms-first, admin:checks-have-three-states, admin:check-handled-with-reason,
// admin:actions-confirm-with-reason): the page lands on Health, the checks show in three states with what they found and
// their history, a check in alarm is marked handled with a reason, and the rail carries the counts.
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { api, type Fetch } from "../../shared/net/http";
// Registers Testing Library's cleanup for this file.
import "../../shared/testing/render";
import { ADMIN_GETS, CHECKS } from "./admin.testing";
import { words } from "./admin.words";
import { ADMIN_SECTIONS, AdminPage } from "./AdminPage";
import { adminApi } from "./api";

const BASE = "http://admin.test";

interface Call {
  method: string;
  path: string;
  body: unknown;
}

function health(over: Record<string, (call: Call) => unknown> = {}): Call[] {
  const calls: Call[] = [];
  const fetch: Fetch = (input, init) => {
    const url = new URL(input);
    const call: Call = { method: init?.method ?? "GET", path: url.pathname, body: typeof init?.body === "string" ? (JSON.parse(init.body) as unknown) : undefined };
    calls.push(call);
    const handler = over[`${call.method} ${url.pathname}`];
    const answer = handler === undefined ? (call.method === "GET" ? ADMIN_GETS[url.pathname] : undefined) : handler(call);
    return Promise.resolve(answer === undefined ? new Response("404 Not Found", { status: 404 }) : Response.json(answer));
  };
  render(<AdminPage api={adminApi(api({ baseUrl: BASE, fetch }), BASE)} />);
  return calls;
}

const checkRow = (name: string) => screen.getByRole("list", { name: words("admin.checks") }).querySelector(`[data-check="${name}"]`) as HTMLElement;

describe("the Health section", () => {
  test("[admin:sections-alarms-first] given the admin page, when it opens, then it lands on Health, the rail holds the seven sections in order, and the counts in alarm and waiting for a person stand beside Health, Moderation and Adverts", async () => {
    health();
    expect(ADMIN_SECTIONS).toEqual(["health", "overview", "players", "money", "moderation", "adverts", "settings"]);
    expect(screen.getByRole("tab", { name: /Health/ }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent?.replace(/\d+$/, ""))).toEqual(["Health", "Overview", "Players", "Money", "Moderation", "Adverts", "Settings"]);
    await waitFor(() => expect(screen.getByRole("tab", { name: /Health/ }).textContent).toBe("Health2"));
    expect(screen.getByRole("tab", { name: /Moderation/ }).textContent).toBe("Moderation3");
    expect(screen.getByRole("tab", { name: /Adverts/ }).textContent).toBe("Adverts1");
    expect(screen.getByRole("tab", { name: /Overview/ }).textContent).toBe("Overview");
  });

  test("[admin:checks-have-three-states] given the checks, when Health opens, then the headline counts those in alarm, every check shows its state, its value against its limit and since when, in alarm first, and a check with no data says so", async () => {
    health();
    expect((await screen.findByText(words("admin.health.alarm", { count: 2 }))).closest("[data-headline]")?.getAttribute("data-headline")).toBe("alarm");
    expect(screen.getByText(words("admin.health.counts", { ok: 3, noData: 1 }))).toBeTruthy();
    const rows = [...screen.getByRole("list", { name: words("admin.checks") }).querySelectorAll("[data-check]")];
    expect(rows.map((row) => [row.getAttribute("data-check"), row.getAttribute("data-state")])).toEqual([
      ["money-suspects", "alarm"],
      ["diverged-lives", "alarm"],
      ["nightly-counts", "no-data"],
      ["draw-payouts", "ok"],
      ["asked-early", "ok"],
      ["reports-overdue", "ok"],
    ]);
    const suspects = checkRow("money-suspects");
    expect(within(suspects).getByText(words("admin.state.alarm"))).toBeTruthy();
    expect(within(suspects).getByText(words("admin.check.value", { value: "1", limit: "0" }))).toBeTruthy();
    expect(within(suspects).getByText(words("admin.check.since", { when: "8 Oct 2026 02:00 WAT" }))).toBeTruthy();
    const nightly = checkRow("nightly-counts");
    expect(within(nightly).getByText(words("admin.state.no-data"))).toBeTruthy();
    expect(within(checkRow("draw-payouts")).getByText(words("admin.state.ok"))).toBeTruthy();
  });

  test("[admin:checks-have-three-states] [server:ledger-alarm-lists-suspects] given a check in alarm, when its row is opened, then it says what to do, lists what it found with the rollback check a step away, and its history newest first with who handled it", async () => {
    health();
    await screen.findByText(words("admin.health.alarm", { count: 2 }));
    const diverged = checkRow("diverged-lives");
    fireEvent.click(within(diverged).getByRole("button", { name: words("admin.check.open", { name: words("admin.check.diverged-lives") }) }));
    expect(within(diverged).getByText(words("admin.check.diverged-lives.do"))).toBeTruthy();
    const found = within(diverged).getByRole("list", { name: words("admin.check.found") });
    expect(within(found).getAllByRole("listitem").map((item) => item.querySelector("span")?.textContent)).toEqual(["7 Oct: character.c-19bd diverged at version 88 and waits for the rollback tool."]);
    const history = within(diverged).getByRole("list", { name: words("admin.check.history") });
    expect(within(history).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      words("admin.check.change", { when: "8 Oct 2026 11:00 WAT", state: words("admin.state.alarm") }),
      words("admin.check.handled", { when: "29 Sep 2026 13:00 WAT", admin: "account.owner", reason: "Replayed and rolled back." }),
      words("admin.check.change", { when: "28 Sep 2026 13:00 WAT", state: words("admin.state.alarm") }),
    ]);
    fireEvent.click(within(found).getByRole("button", { name: words("admin.alarm.check", { character: "character.c-19bd" }) }));
    expect(screen.getByRole("tab", { name: words("admin.section.money") }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByLabelText(words("admin.rollback.character"))).toHaveProperty("value", "character.c-19bd");
  });

  test("[admin:check-handled-with-reason] [admin:actions-confirm-with-reason] given a check in alarm, when it is marked handled, then the dialog names the act on its button, needs a reason, sends it for that check, and the checks are read again", async () => {
    const handled = { ...CHECKS, checks: CHECKS.ok ? CHECKS.checks.map((check) => (check.check === "diverged-lives" ? { ...check, state: "ok" as const } : check)) : [] };
    const calls = health({ "POST /api/admin/checks/diverged-lives/handle": () => handled });
    await screen.findByText(words("admin.health.alarm", { count: 2 }));
    const diverged = checkRow("diverged-lives");
    fireEvent.click(within(diverged).getByRole("button", { name: words("admin.check.open", { name: words("admin.check.diverged-lives") }) }));
    fireEvent.click(within(diverged).getByRole("button", { name: words("admin.check.handle") }));
    const dialog = await screen.findByRole("dialog");
    const act = within(dialog).getByRole("button", { name: words("admin.check.handle.act", { name: words("admin.check.diverged-lives") }) });
    expect(act).toHaveProperty("disabled", true);
    expect(within(dialog).getByText(words("admin.switch.reason"))).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText(words("admin.check.handle.for", { name: words("admin.check.diverged-lives") })), { target: { value: " Rolled back " } });
    expect(act).toHaveProperty("disabled", false);
    fireEvent.click(act);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(calls.filter((call) => call.method === "POST")).toEqual([{ method: "POST", path: "/api/admin/checks/diverged-lives/handle", body: { reason: "Rolled back" } }]);
    await waitFor(() => expect(calls.filter((call) => call.path === "/api/admin/checks")).toHaveLength(2));
  });

  test("[admin:checks-have-three-states] given the checks route refuses, when Health opens, then the refusal shows as it came", async () => {
    health({ "GET /api/admin/checks": () => ({ ok: false, code: "missing", detail: "No checks store." }) });
    expect((await screen.findByRole("alert")).textContent).toBe(words("admin.refused.code", { code: "missing", detail: "No checks store." }));
  });

  test("[server:rejections-write-nothing] given rejections counted, when Health opens, then each code shows with its count as a bar, the largest first", async () => {
    health();
    const table = await screen.findByRole("table", { name: words("admin.rejections.title") });
    expect(within(table).getAllByRole("row").map((row) => row.textContent)).toEqual(["CodeCount", "stale41", "setpiece-open17", "rate-limited3"]);
  });
});
