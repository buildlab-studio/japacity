import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { api, type Fetch } from "../../shared/net/http";
import { formatMoney } from "../../shared/words/format";
// Registers Testing Library's cleanup for this file.
import "../../shared/testing/render";
import { ADMIN_GETS, CAMPAIGNS, PENDING_LIGHTS, QUEUE, ROLLBACK, SWITCH_ROW, YESTERDAY } from "./admin.testing";
import { words } from "./admin.words";
import { AdminPage, type AdminTab } from "./AdminPage";
import { AdminRoute } from "./AdminRoute";
import { adminApi, type AdminApi } from "./api";

interface Call {
  method: string;
  path: string;
  query: string;
  body: unknown;
}

type Handler = (call: Call) => unknown;

const BASE = "http://admin.test";

/** The server's admin routes, answered from the fixtures; `over` answers a route its own way, undefined for a 404. */
function fakeServer(over: Record<string, Handler> = {}): { calls: Call[]; admin: AdminApi } {
  const calls: Call[] = [];
  const fetch: Fetch = (input, init) => {
    const url = new URL(input);
    const method = init?.method ?? "GET";
    const call: Call = { method, path: url.pathname, query: url.search, body: typeof init?.body === "string" ? (JSON.parse(init.body) as unknown) : undefined };
    calls.push(call);
    const handler = over[`${method} ${url.pathname}`];
    const answer = handler === undefined ? (method === "GET" ? ADMIN_GETS[url.pathname] : undefined) : handler(call);
    return Promise.resolve(answer === undefined ? new Response("404 Not Found", { status: 404 }) : Response.json(answer));
  };
  return { calls, admin: adminApi(api({ baseUrl: BASE, fetch }), BASE) };
}

/** R-MODERATION-012: the page reads and acts only through the admin routes and the account's own row. */
function expectOnlyAdminRoutes(calls: readonly Call[]): void {
  for (const call of calls) expect(call.path === "/api/account" || call.path.startsWith("/api/admin/"), `${call.method} ${call.path}`).toBe(true);
  expect(calls.some((call) => call.path === "/api/command" || call.path === "/api/view")).toBe(false);
}

function page(tab: AdminTab, over: Record<string, Handler> = {}) {
  const server = fakeServer(over);
  render(<AdminPage api={server.admin} tab={tab} />);
  return server;
}

async function confirm(summary: string): Promise<void> {
  const sheet = await screen.findByRole("dialog");
  expect(within(sheet).getByText(summary)).toBeTruthy();
  fireEvent.click(within(sheet).getByRole("button", { name: words("admin.confirm.send") }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
}

function posts(calls: readonly Call[]): Call[] {
  return calls.filter((call) => call.method === "POST");
}

afterEach(() => {
  window.history.replaceState({}, "", "/");
});

describe("where the admin page mounts", () => {
  test("[R-MODERATION-012] given /admin and an account on the admin list, when the app opens, then the admin page replaces the game", async () => {
    window.history.replaceState({}, "", "/admin");
    const server = fakeServer();
    render(
      <AdminRoute api={server.admin}>
        <p>the game</p>
      </AdminRoute>,
    );
    expect(await screen.findByRole("heading", { name: words("admin.title"), level: 1 })).toBeTruthy();
    expect(screen.queryByText("the game")).toBeNull();
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["Money", "Rejections", "Rollback", "Moderation", "Analytics", "Numbers", "Adverts", "Switches"]);
    // On a phone the tabs wrap to a second row rather than run off the right edge unseen.
    const row = screen.getByRole("tablist");
    expect(row.className).toContain("flex-wrap");
    expect(row.className).not.toContain("overflow-x-auto");
  });

  test("[R-MODERATION-012] given /admin and an account off the list, when the app opens, then the ordinary app shows and the page never mounts", async () => {
    window.history.replaceState({}, "", "/admin");
    const server = fakeServer({ "GET /api/account": () => ({ ...(ADMIN_GETS["/api/account"] as object), account: { id: "account.ada", country: "NG", age: { passed: true, method: "declared" }, createdAt: 0, character: null, admin: false } }) });
    render(
      <AdminRoute api={server.admin}>
        <p>the game</p>
      </AdminRoute>,
    );
    await waitFor(() => expect(server.calls.map((call) => call.path)).toEqual(["/api/account"]));
    expect(screen.getByText("the game")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: words("admin.title") })).toBeNull();
  });

  test("[R-MODERATION-012] given /admin and no session or no server behind the page, when the app opens, then the ordinary app shows", async () => {
    window.history.replaceState({}, "", "/admin");
    for (const answer of [{ ok: false, code: "signed-out", detail: "Sign in first." }, undefined]) {
      const server = fakeServer({ "GET /api/account": () => answer });
      const { unmount } = render(
        <AdminRoute api={server.admin}>
          <p>the game</p>
        </AdminRoute>,
      );
      await waitFor(() => expect(server.calls).toHaveLength(1));
      expect(screen.getByText("the game")).toBeTruthy();
      expect(screen.queryByRole("tablist")).toBeNull();
      unmount();
    }
  });

  test("[R-MODERATION-012] given any other address, when the app opens, then the account is not even asked", async () => {
    window.history.replaceState({}, "", "/");
    const server = fakeServer();
    render(
      <AdminRoute api={server.admin}>
        <p>the game</p>
      </AdminRoute>,
    );
    await Promise.resolve();
    expect(screen.getByText("the game")).toBeTruthy();
    expect(server.calls).toEqual([]);
  });
});

describe("the money tab", () => {
  test("[R-SERVER-011] given yesterday's report, when the tab opens, then money created and destroyed shows by reason and currency, in whole units and in minor units", async () => {
    const server = page("money");
    const created = await screen.findByRole("table", { name: words("admin.money.created") });
    expect(within(created).getByRole("row", { name: `salary NGN ${formatMoney(125_000_000, "NGN")} 125,000,000` })).toBeTruthy();
    expect(within(created).getByRole("row", { name: `salary GBP ${formatMoney(320_000, "GBP")} 320,000` })).toBeTruthy();
    const destroyed = screen.getByRole("table", { name: words("admin.money.destroyed") });
    expect(within(destroyed).getByRole("row", { name: `rent NGN ${formatMoney(48_000_000, "NGN")} 48,000,000` })).toBeTruthy();
    expect(screen.getByText(words("admin.money.for", { day: "2026-10-07" }))).toBeTruthy();
    expect(server.calls.find((call) => call.path === "/api/admin/report")?.query).toBe("");
    expectOnlyAdminRoutes(server.calls);
  });

  test("[R-SERVER-011] given a UTC day typed, when it is shown, then the report for that day is asked by its day number; a date that is not one cannot be sent", async () => {
    const server = page("money");
    await screen.findByRole("table", { name: words("admin.money.created") });
    const day = screen.getByLabelText(words("admin.money.day"));
    fireEvent.change(day, { target: { value: "2026-10-7" } });
    expect(screen.getByRole("button", { name: words("admin.money.show") })).toHaveProperty("disabled", true);
    fireEvent.change(day, { target: { value: "2026-10-07" } });
    fireEvent.click(screen.getByRole("button", { name: words("admin.money.show") }));
    await waitFor(() => expect(server.calls.filter((call) => call.path === "/api/admin/report").map((call) => call.query)).toEqual(["", `?day=${String(YESTERDAY)}`]));
  });

  test("[R-SERVER-012] given alarms raised, when the tab opens, then each is listed with its figures, and a character's alarm opens the rollback check on that character", async () => {
    page("money");
    const alarms = await screen.findByRole("list", { name: words("admin.money.alarms") });
    const items = within(alarms).getAllByRole("listitem");
    expect(items.map((item) => item.querySelector("span")?.textContent)).toEqual([
      `2026-10-07: character.c-7f2a made ${formatMoney(900_000_000, "NGN")} NGN by salary, over its ceiling of ${formatMoney(300_000_000, "NGN")}.`,
      "2026-10-07: draw 412 failed the win check at 61,000,000, over its limit of 60,000,000.",
      "2026-10-07: character.c-19bd diverged at version 88 and waits for the rollback tool.",
    ]);
    expect(within(items[1]!).queryByRole("button")).toBeNull();
    fireEvent.click(within(items[2]!).getByRole("button", { name: words("admin.alarm.check", { character: "character.c-19bd" }) }));
    expect(screen.getByRole("tab", { name: words("admin.tab.rollback") }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByLabelText(words("admin.rollback.character"))).toHaveProperty("value", "character.c-19bd");
  });

  test("[R-SERVER-012] given the alarms route refuses, when the tab opens, then the refusal shows as it came", async () => {
    page("money", { "GET /api/admin/alarms": () => ({ ok: false, code: "missing", detail: "No alarms store." }) });
    expect((await screen.findByRole("alert")).textContent).toBe(words("admin.refused.code", { code: "missing", detail: "No alarms store." }));
  });
});

describe("the rejections tab", () => {
  test("[R-SERVER-005] given rejections counted, when the tab opens, then each code shows with its count", async () => {
    page("rejections");
    const table = await screen.findByRole("table", { name: words("admin.rejections.title") });
    expect(within(table).getAllByRole("row").map((row) => row.textContent)).toEqual(["CodeCount", "no-turns17", "rate-limited3", "stale41"]);
  });
});

describe("the rollback tab", () => {
  test("[R-SERVER-008] given a character, when the check is run, then it is confirmed first, asked once for that one character, and the first difference and the dropped commands show", async () => {
    const server = page("rollback", { "GET /api/admin/rollback/character.c-19bd": () => ROLLBACK });
    const run = screen.getByRole("button", { name: words("admin.rollback.run") });
    expect(run).toHaveProperty("disabled", true);
    fireEvent.change(screen.getByLabelText(words("admin.rollback.character")), { target: { value: "character.c-19bd" } });
    fireEvent.click(run);
    expect(server.calls).toEqual([]);
    await confirm(words("admin.rollback.confirm", { character: "character.c-19bd" }));
    expect(await screen.findByText(words("admin.rollback.diff", { v: 88, stored: "a91f03c2", replayed: "5be0d417" }))).toBeTruthy();
    expect(screen.getByText(words("admin.rollback.summary", { character: "character.c-19bd", v: 96, replayed: 96 }))).toBeTruthy();
    const dropped = screen.getByRole("table", { name: words("admin.rollback.dropped") });
    expect(within(dropped).getByRole("row", { name: "88 lottery/buy cannot-afford Not enough money for 3 tickets." })).toBeTruthy();
    expect(server.calls.map((call) => `${call.method} ${call.path}`)).toEqual(["GET /api/admin/rollback/character.c-19bd"]);
  });

  test("[R-SERVER-008] given a character the server does not hold, when the check is run, then its refusal shows; given a clean one, then no difference is said", async () => {
    page("rollback", {
      "GET /api/admin/rollback/character.gone": () => ({ ok: false, code: "missing", detail: "No character character.gone." }),
      "GET /api/admin/rollback/character.clean": () => ({ ok: true, report: { character: "character.clean", v: 4, replayed: 4, firstDiff: null, dropped: [] } }),
    });
    const field = screen.getByLabelText(words("admin.rollback.character"));
    fireEvent.change(field, { target: { value: "character.gone" } });
    fireEvent.click(screen.getByRole("button", { name: words("admin.rollback.run") }));
    await confirm(words("admin.rollback.confirm", { character: "character.gone" }));
    expect((await screen.findByRole("alert")).textContent).toBe(words("admin.refused.code", { code: "missing", detail: "No character character.gone." }));
    fireEvent.change(field, { target: { value: "character.clean" } });
    fireEvent.click(screen.getByRole("button", { name: words("admin.rollback.run") }));
    await confirm(words("admin.rollback.confirm", { character: "character.clean" }));
    expect(await screen.findByText(words("admin.rollback.clean"))).toBeTruthy();
  });

  test("[R-SERVER-010] given the rollback tab, then it offers a check on one character and no control that changes any character", () => {
    page("rollback");
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(screen.getAllByRole("button").map((button) => button.textContent).filter((name) => !["Money", "Rejections", "Rollback", "Moderation", "Analytics", "Adverts", "Switches"].includes(name))).toEqual([words("admin.rollback.run")]);
  });
});

describe("the moderation tab", () => {
  test("[R-MODERATION-010] [R-MODERATION-011] given open reports and an appeal, when the tab opens, then they are listed in the server's order with the oldest's age against the target", async () => {
    page("moderation");
    const queue = await screen.findByRole("list", { name: words("admin.moderation.queue") });
    expect([...queue.querySelectorAll("[data-item]")].map((item) => item.getAttribute("data-item"))).toEqual(["report.1", "report.2", "appeal.1"]);
    expect(screen.getByText(words("admin.moderation.summary", { count: 3, oldest: "1 d 6 h", target: "1 d", overdue: 1 }))).toBeTruthy();
  });

  test("[R-MODERATION-013] given a report, when it is shown, then its reason, the held messages as phrases with times, and both accounts' region, age, past reports and earlier actions show, and never an email", async () => {
    page("moderation");
    const item = (await screen.findByRole("heading", { name: words("admin.moderation.report", { id: "report.1", reason: "scam" }) })).closest("li")!;
    const held = within(item).getByRole("heading", { name: words("admin.moderation.messages") }).nextElementSibling!;
    expect([...held.querySelectorAll("li")].map((line) => line.textContent)).toEqual([
      "2026-10-07 05:00 UTC, from account.ada: Can you send me something small?",
      "2026-10-07 05:01 UTC, from account.ada: I need {fill} (50k)",
    ]);
    const reporter = item.querySelector("[data-account='account.bola']")!;
    expect(reporter.textContent).toContain("Region GB, account 3 d old");
    expect(reporter.textContent).toContain("report.1: scam, 2026-10-07 06:00 UTC, open");
    const reported = item.querySelector("[data-account='account.ada']")!;
    expect(reported.textContent).toContain("report.old: harassment, 2026-09-18 12:00 UTC, decided, acted");
    expect(reported.textContent).toContain("2026-09-19 12:00 UTC: warn by account.owner, for harassment");
    expect(within(item).getByText(words("admin.moderation.hold", { until: "2026-10-21 12:00 UTC" }))).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/@/);
    const other = screen.getByRole("heading", { name: words("admin.moderation.report", { id: "report.2", reason: "other" }) }).closest("li")!;
    expect(within(other).getByText(words("admin.moderation.unverified"))).toBeTruthy();
    expect(other.querySelector("[data-account='account.chidi']")?.textContent).toContain("No region, account gone");
  });

  test("[R-MODERATION-014] given a report, when it is closed with a mute, then the days are needed, it is confirmed, the action, reason and days are sent, and the logged entry is shown after the queue reloads", async () => {
    let queues = 0;
    const server = page("moderation", {
      "GET /api/admin/moderation/queue": () => {
        queues += 1;
        return queues === 1 ? QUEUE : { ok: true, queue: { ...(QUEUE as { queue: object }).queue, items: [], oldest: 0, overdue: 0 } };
      },
      "POST /api/admin/moderation/report.1/close": () => ({ ok: true, entry: { id: "log.9", admin: "account.owner", at: 0, item: "report.1", action: "mute", params: { account: "account.ada", days: 7 }, reason: "scam" }, report: {} }),
    });
    const item = (await screen.findByRole("heading", { name: words("admin.moderation.report", { id: "report.1", reason: "scam" }) })).closest("li")!;
    fireEvent.change(within(item).getByLabelText(words("admin.close.action")), { target: { value: "mute" } });
    fireEvent.change(within(item).getByLabelText(words("admin.close.reason")), { target: { value: "scam" } });
    const close = within(item).getByRole("button", { name: words("admin.close.send") });
    expect(close).toHaveProperty("disabled", true);
    fireEvent.change(within(item).getByLabelText(words("admin.close.days")), { target: { value: "3651" } });
    expect(close).toHaveProperty("disabled", true);
    fireEvent.change(within(item).getByLabelText(words("admin.close.days")), { target: { value: "7" } });
    fireEvent.change(within(item).getByLabelText(words("admin.close.note")), { target: { value: " second time " } });
    fireEvent.click(close);
    await confirm(words("admin.close.confirm.days", { item: "report.1", action: "mute", days: "7", reason: "scam" }));
    expect((await screen.findByRole("status", { name: words("admin.moderation.answer") })).textContent).toBe(words("admin.close.done", { entry: "log.9" }));
    expect(posts(server.calls)).toEqual([{ method: "POST", path: "/api/admin/moderation/report.1/close", query: "", body: { action: "mute", reason: "scam", days: 7, note: "second time" } }]);
    expect(await screen.findByText(words("admin.moderation.empty"))).toBeTruthy();
    expectOnlyAdminRoutes(server.calls);
  });

  test("[R-MODERATION-014] given a report, when it is closed with a refer, then the outside body is needed and sent; a refusal shows as it came", async () => {
    const server = page("moderation", { "POST /api/admin/moderation/report.1/close": () => ({ ok: false, code: "ended", detail: "Report report.1 is decided." }) });
    const item = (await screen.findByRole("heading", { name: words("admin.moderation.report", { id: "report.1", reason: "scam" }) })).closest("li")!;
    fireEvent.change(within(item).getByLabelText(words("admin.close.action")), { target: { value: "refer" } });
    expect(within(item).getByRole("button", { name: words("admin.close.send") })).toHaveProperty("disabled", true);
    fireEvent.change(within(item).getByLabelText(words("admin.close.body")), { target: { value: "The police" } });
    fireEvent.click(within(item).getByRole("button", { name: words("admin.close.send") }));
    await confirm(words("admin.close.confirm.body", { item: "report.1", action: "refer", body: "The police", reason: "other" }));
    expect((await within(item).findByRole("alert")).textContent).toBe(words("admin.refused.code", { code: "ended", detail: "Report report.1 is decided." }));
    expect(posts(server.calls).map((call) => call.body)).toEqual([{ action: "refer", reason: "other", body: "The police" }]);
  });

  test("[R-MODERATION-014] given every action a report can be closed with, then the page offers exactly those and nothing that edits a balance or a state", async () => {
    page("moderation");
    const item = (await screen.findByRole("heading", { name: words("admin.moderation.report", { id: "report.1", reason: "scam" }) })).closest("li")!;
    const options = [...within(item).getByLabelText(words("admin.close.action")).querySelectorAll("option")].map((option) => option.value);
    expect(options).toEqual(["dismiss", "warn", "mute", "suspend", "ban", "reset-name", "refer", "rollback"]);
  });

  test("[R-MODERATION-016] given an appeal, when it is decided, then the outcome and reason are sent; the server's not-yours refusal shows as it came", async () => {
    const server = page("moderation", { "POST /api/admin/moderation/appeal.1/close": () => ({ ok: false, code: "not-yours", detail: "Another admin decides an appeal against your own action." }) });
    const item = (await screen.findByRole("heading", { name: words("admin.moderation.appeal", { id: "appeal.1" }) })).closest("li")!;
    expect(within(item).getByText(words("admin.moderation.against", { action: "warn", account: "account.ada", admin: "account.owner", at: "2026-09-19 12:00 UTC", reason: "harassment" }))).toBeTruthy();
    fireEvent.change(within(item).getByLabelText(words("admin.decide.outcome")), { target: { value: "overturned" } });
    fireEvent.click(within(item).getByRole("button", { name: words("admin.decide.send") }));
    await confirm(words("admin.decide.confirm", { item: "appeal.1", outcome: "overturned", reason: "other" }));
    expect((await within(item).findByRole("alert")).textContent).toBe(words("admin.refused.code", { code: "not-yours", detail: "Another admin decides an appeal against your own action." }));
    expect(posts(server.calls).map((call) => [call.path, call.body])).toEqual([["/api/admin/moderation/appeal.1/close", { outcome: "overturned", reason: "other" }]]);
  });

  test("[R-MODERATION-015] given an item or an account named, when the log is shown, then its entries are listed with nothing to change or remove them", async () => {
    const server = page("moderation");
    await screen.findByRole("list", { name: words("admin.moderation.queue") });
    const show = screen.getByRole("button", { name: words("admin.log.show") });
    expect(show).toHaveProperty("disabled", true);
    fireEvent.change(screen.getByLabelText(words("admin.log.account")), { target: { value: "account.ada" } });
    fireEvent.click(show);
    const table = await screen.findByRole("table", { name: words("admin.log.title") });
    expect(within(table).getByRole("row", { name: "2026-09-19 12:00 UTC account.owner report.old warn account account.ada harassment First time." })).toBeTruthy();
    expect(within(table).queryAllByRole("button")).toEqual([]);
    expect(server.calls.filter((call) => call.path === "/api/admin/moderation/log").map((call) => call.query)).toEqual(["?account=account.ada"]);
  });
});

describe("the dedication lights", () => {
  test("[R-MODERATION-021] given lights awaiting a look, when the moderation tab opens, then each shows its name, years, the account's username and region and when lit, oldest first, with Approve and Refuse", async () => {
    const server = page("moderation");
    const list = await screen.findByRole("list", { name: words("admin.lights.list") });
    const items = [...list.querySelectorAll("[data-light]")];
    expect(items.map((item) => item.getAttribute("data-light"))).toEqual(["account.ada", "account.bola"]);
    expect(items[0]?.textContent).toContain("Mama Nkechi");
    expect(items[0]?.textContent).toContain("1951 to 2024");
    expect(items[0]?.textContent).toContain(words("admin.lights.who", { username: "ada_lagos", account: "account.ada", region: "NG", at: "2026-10-06 12:00 UTC" }));
    expect(items[1]?.textContent).toContain(words("admin.lights.no-years"));
    expect(within(items[0] as HTMLElement).getByRole("button", { name: words("admin.lights.approve") })).toBeTruthy();
    expect(within(items[0] as HTMLElement).getByRole("button", { name: words("admin.lights.refuse") })).toBeTruthy();
    expect(server.calls.filter((call) => call.path === "/api/admin/dedication/pending")).toHaveLength(1);
    expectOnlyAdminRoutes(server.calls);
  });

  test("[R-MODERATION-021] [R-MODERATION-015] given a light, when it is approved, then it is confirmed, the approval is sent for that account, the logged entry shows and the list is read again", async () => {
    let reads = 0;
    const server = page("moderation", {
      "GET /api/admin/dedication/pending": () => {
        reads += 1;
        return reads === 1 ? PENDING_LIGHTS : { ok: true, lights: (PENDING_LIGHTS as { lights: unknown[] }).lights.slice(1) };
      },
      "POST /api/admin/dedication/account.ada/approve": () => ({ ok: true, entry: "log.21" }),
    });
    const item = (await screen.findByRole("heading", { name: "Mama Nkechi" })).closest("li")!;
    fireEvent.click(within(item).getByRole("button", { name: words("admin.lights.approve") }));
    await confirm(words("admin.lights.confirm.approve", { name: "Mama Nkechi", account: "account.ada" }));
    expect((await screen.findByRole("status", { name: words("admin.moderation.answer") })).textContent).toBe(words("admin.close.done", { entry: "log.21" }));
    expect(posts(server.calls)).toEqual([{ method: "POST", path: "/api/admin/dedication/account.ada/approve", query: "", body: {} }]);
    await waitFor(() => expect(document.querySelectorAll("[data-light]")).toHaveLength(1));
    expect(reads).toBe(2);
  });

  test("[R-MODERATION-021] given a light, when it is refused, then it is confirmed and the refusal is sent; a refusal from the server shows as it came", async () => {
    const server = page("moderation", { "POST /api/admin/dedication/account.bola/refuse": () => ({ ok: false, code: "unknown-id", detail: "No light for account.bola." }) });
    const item = (await screen.findByRole("heading", { name: "Uncle Tunde" })).closest("li")!;
    fireEvent.click(within(item).getByRole("button", { name: words("admin.lights.refuse") }));
    await confirm(words("admin.lights.confirm.refuse", { name: "Uncle Tunde", account: "account.bola" }));
    expect((await within(item).findByRole("alert")).textContent).toBe(words("admin.refused.code", { code: "unknown-id", detail: "No light for account.bola." }));
    expect(posts(server.calls).map((call) => call.path)).toEqual(["/api/admin/dedication/account.bola/refuse"]);
  });

  test("[R-MODERATION-021] given no light awaiting a look, when the tab opens, then the list says so", async () => {
    page("moderation", { "GET /api/admin/dedication/pending": () => ({ ok: true, lights: [] }) });
    expect(await screen.findByText(words("admin.lights.empty"))).toBeTruthy();
  });
});

describe("the analytics tab", () => {
  test("[R-ANALYTICS-009] [R-ANALYTICS-010] given the dashboard, when the tab opens, then the daily series shows as a table and a count under minShown only as fewer than", async () => {
    const server = page("analytics");
    const daily = await screen.findByRole("table", { name: words("admin.analytics.daily") });
    expect(within(daily).getAllByRole("row").map((row) => [...row.querySelectorAll("td")].map((cell) => cell.textContent))).toEqual([
      [],
      ["2026-10-06", "fewer than 10", "fewer than 10", "900"],
      ["2026-10-07", "121", "fewer than 10", "901"],
      ["2026-10-08", "122", "34", "902"],
    ]);
    expect(screen.getByText(words("admin.analytics.window", { from: "2026-09-08", day: "2026-10-08", minShown: 10 }))).toBeTruthy();
    expect(server.calls.find((call) => call.path === "/api/admin/analytics")?.query).toBe("");
  });

  test("[R-ANALYTICS-011] given the sign-up weeks, when the tab opens, then day 1 and day 7 show beside the reference lines, a hidden rate says so, and an ask before the early win shows in red", async () => {
    page("analytics");
    const weeks = await screen.findByRole("table", { name: words("admin.analytics.weeks") });
    const cells = within(weeks).getAllByRole("row").slice(1).map((row) => [...row.querySelectorAll("td")].map((cell) => cell.textContent));
    expect(cells).toEqual([
      ["2026-09-28", "210", "92", "43.8%, at or over the line", "25", "11.9%, under the line", "80", "61", "30", "22", "fewer than 10"],
      ["2026-10-05", "64", "fewer than 10", "hidden", "fewer than 10", "hidden", "21", "14", "fewer than 10", "fewer than 10", "fewer than 10"],
    ]);
    expect(screen.getByText(words("admin.analytics.reference", { d1: "40%", d7: "15%" }))).toBeTruthy();
    const fault = screen.getByRole("alert");
    expect(fault.textContent).toBe(words("admin.analytics.ask"));
    expect(fault.className).toContain("text-bad");
  });

  test("[R-ANALYTICS-009] given a day typed, when it is shown, then the dashboard for that day is asked", async () => {
    const server = page("analytics");
    await screen.findByRole("table", { name: words("admin.analytics.daily") });
    fireEvent.change(screen.getByLabelText(words("admin.analytics.day")), { target: { value: "2026-10-01" } });
    fireEvent.click(screen.getByRole("button", { name: words("admin.analytics.show") }));
    await waitFor(() => expect(server.calls.filter((call) => call.path === "/api/admin/analytics").map((call) => call.query)).toEqual(["", "?day=2026-10-01"]));
  });
});

describe("the adverts tab", () => {
  test("[R-ADVERT-012] given a pending campaign shown in Nigeria in a restricted category, when it is reviewed, then every check it needs is offered, and only the ticked ones are sent with the note", async () => {
    const server = page("adverts", { "POST /api/admin/adverts/campaigns/campaign-a1/approve": () => ({ ok: true, campaign: { id: "campaign-a1", status: "approved" } }) });
    const card = (await screen.findByRole("heading", { name: words("admin.campaign.title", { id: "campaign-a1" }) })).closest("li")!;
    expect(within(card).getByText(words("admin.campaign.advertiser", { name: "Brightpath Study Centre", country: "NG", number: "RC-000123", contact: "Kemi Ade", email: "kemi@brightpath.example" }))).toBeTruthy();
    const review = within(card).getByRole("group", { name: words("admin.campaign.review") });
    const checks = within(review).getByRole("group", { name: words("admin.review.checks") });
    expect(within(checks).getAllByRole("checkbox").map((box) => box.parentElement?.textContent)).toEqual(["registered-business", "category", "accredited-institution", "no-charging-agent", "no-score-or-visa-promise", "regulator-approval"]);
    fireEvent.click(within(checks).getByRole("checkbox", { name: "registered-business" }));
    fireEvent.click(within(checks).getByRole("checkbox", { name: "regulator-approval" }));
    fireEvent.change(within(review).getByLabelText(words("admin.review.note")), { target: { value: "Register checked." } });
    fireEvent.click(within(review).getByRole("button", { name: words("admin.review.approve") }));
    await confirm(words("admin.review.confirm", { outcome: "Approve", what: words("admin.campaign.title", { id: "campaign-a1" }), checks: "registered-business, regulator-approval" }));
    await waitFor(() => expect(posts(server.calls)).toHaveLength(1));
    expect(posts(server.calls)[0]).toEqual({ method: "POST", path: "/api/admin/adverts/campaigns/campaign-a1/approve", query: "", body: { checks: ["registered-business", "regulator-approval"], note: "Register checked." } });
    expectOnlyAdminRoutes(server.calls);
  });

  test("[R-ADVERT-012] given a campaigns reply naming checks the page has never seen, when a version is reviewed, then exactly the reply's checks are offered", async () => {
    if (!CAMPAIGNS.ok) throw new Error("The fixture is a refusal.");
    const [first, ...rest] = CAMPAIGNS.campaigns;
    if (first === undefined) throw new Error("The fixture has no campaign.");
    const creatives = first.creatives.map((creative) => ({ ...creative, checks: ["format", "new-check"] }));
    page("adverts", { "GET /api/admin/adverts/campaigns": () => ({ ok: true, campaigns: [{ ...first, checks: ["registered-business", "another-check"], creatives }, ...rest] }) });
    const card = (await screen.findByRole("heading", { name: words("admin.campaign.title", { id: "campaign-a1" }) })).closest("li")!;
    const review = within(card).getByRole("group", { name: words("admin.campaign.review") });
    expect(within(review).getAllByRole("checkbox").map((box) => box.parentElement?.textContent)).toEqual(["registered-business", "another-check"]);
    const version = within(card).getByRole("heading", { name: words("admin.creative.title", { id: "creative-b2", version: 1 }) }).closest("li")!;
    expect(within(within(version).getByRole("group", { name: words("admin.creative.review") })).getAllByRole("checkbox").map((box) => box.parentElement?.textContent)).toEqual(["format", "new-check"]);
  });

  test("[R-ADVERT-010] given an approval missing checks, when the server refuses it, then the missing checks are named", async () => {
    page("adverts", {
      "POST /api/admin/adverts/creatives/creative-b2/1/approve": () => ({ ok: false, code: "unchecked", detail: "Not approved: the review has not recorded text, link-domain.", missing: ["text", "link-domain"] }),
    });
    const version = (await screen.findByRole("heading", { name: words("admin.creative.title", { id: "creative-b2", version: 1 }) })).closest("li")!;
    const review = within(version).getByRole("group", { name: words("admin.creative.review") });
    expect(within(review).getAllByRole("checkbox").map((box) => box.parentElement?.textContent)).toEqual(["format", "not-game-like", "text", "link-domain"]);
    fireEvent.click(within(review).getByRole("checkbox", { name: "format" }));
    fireEvent.click(within(review).getByRole("button", { name: words("admin.review.approve") }));
    await confirm(words("admin.review.confirm", { outcome: "Approve", what: words("admin.creative.title", { id: "creative-b2", version: 1 }), checks: "format" }));
    const refusal = await within(review).findByRole("alert");
    expect(refusal.textContent).toContain(words("admin.missing", { missing: "text, link-domain" }));
  });

  test("[R-ADVERT-010] [R-ADVERT-011] given creatives and their reviews, when the tab opens, then each version shows its file, text, link, status and its image from the admin route whatever its status, and every review with its reviewer, checks and banned list", async () => {
    page("adverts");
    const image = (id: string, version: number) => `${BASE}/api/admin/adverts/creatives/${id}/${String(version)}/image`;
    const pending = (await screen.findByRole("heading", { name: words("admin.creative.title", { id: "creative-b2", version: 1 }) })).closest("li")!;
    expect(within(pending).getByText(words("admin.creative.file", { format: "png", width: 640, height: 320, bytes: "48,211" }))).toBeTruthy();
    expect(within(pending).getByRole("img", { name: words("admin.creative.image", { id: "creative-b2", version: 1 }) }).getAttribute("src")).toBe(image("creative-b2", 1));
    const live = screen.getByRole("heading", { name: words("admin.creative.title", { id: "creative-d4", version: 1 }) }).closest("li")!;
    expect(within(live).getByRole("img").getAttribute("src")).toBe(image("creative-d4", 1));
    expect(within(live).queryByRole("group")).toBeNull();
    const refused = screen.getByRole("heading", { name: words("admin.creative.title", { id: "creative-d4", version: 2 }) }).closest("li")!;
    expect(within(refused).getByRole("img").getAttribute("src")).toBe(image("creative-d4", 2));
    expect(within(refused).queryByRole("group")).toBeNull();
    const card = live.closest("[data-campaign]")!;
    const reviews = within(card as HTMLElement).getByRole("table", { name: words("admin.reviews") });
    expect(within(reviews).getByRole("row", { name: "creative-d4 1 account.owner 2026-10-06 12:00 UTC format, not-game-like, text 2026-10-08 approved Clean." })).toBeTruthy();
  });

  test("[R-ADVERT-020] given a campaign's daily counts, when the tab opens, then they show as a table by day, slot and region, and a campaign with none says so", async () => {
    page("adverts");
    const live = (await screen.findByRole("heading", { name: words("admin.campaign.title", { id: "campaign-c3" }) })).closest("li")!;
    const counts = within(live).getByRole("table", { name: words("admin.counts") });
    expect(within(counts).getAllByRole("row").map((row) => row.textContent)).toEqual(["DaySlotRegionImpressionsTaps", "2026-10-06advert.phone-tileGB1,20431", "2026-10-07advert.phone-tileGB3889"]);
    const pending = screen.getByRole("heading", { name: words("admin.campaign.title", { id: "campaign-a1" }) }).closest("li")!;
    expect(within(within(pending).getByRole("table", { name: words("admin.counts") })).getByText(words("admin.none"))).toBeTruthy();
  });

  test("[R-ADVERT-014] given a live campaign, when it is pulled or its links rechecked, then each is confirmed and its answer shown", async () => {
    const server = page("adverts", {
      "POST /api/admin/adverts/campaigns/campaign-c3/pull": () => ({ ok: true, campaign: { status: "paused" } }),
      "POST /api/admin/adverts/campaigns/campaign-c3/recheck": () => ({ ok: true, failing: ["https://harbourtea.example/menu"], pulled: true }),
    });
    const card = (await screen.findByRole("heading", { name: words("admin.campaign.title", { id: "campaign-c3" }) })).closest("li")!;
    fireEvent.click(within(card).getByRole("button", { name: words("admin.campaign.recheck") }));
    await confirm(words("admin.campaign.recheck.confirm", { id: "campaign-c3" }));
    expect((await within(card).findByRole("status")).textContent).toBe(words("admin.campaign.recheck.done", { failing: "https://harbourtea.example/menu", pulled: "true" }));
    fireEvent.click(within(card).getByRole("button", { name: words("admin.campaign.pull") }));
    await confirm(words("admin.campaign.pull.confirm", { id: "campaign-c3" }));
    await waitFor(() => expect(posts(server.calls).map((call) => call.path)).toEqual(["/api/admin/adverts/campaigns/campaign-c3/recheck", "/api/admin/adverts/campaigns/campaign-c3/pull"]));
    const pending = screen.getByRole("heading", { name: words("admin.campaign.title", { id: "campaign-a1" }) }).closest("li")!;
    expect(within(pending).queryByRole("button", { name: words("admin.campaign.pull") })).toBeNull();
  });
});

describe("the switches tab", () => {
  test("[R-SERVER-031] given the switch row, when a switch is turned off, then a reason is needed, it is confirmed, the change is sent with the reason, and the row and the log are read again", async () => {
    const server = page("switches", { "POST /api/admin/switches": () => ({ ok: true, switches: { ...SWITCH_ROW, signups: false }, dials: { placeTargets: {}, computerAfterMonths: null } }) });
    const row = (await screen.findByText(words("admin.switch.signups"))).closest("li")!;
    expect(within(row).getByText(words("admin.switch.on"))).toBeTruthy();
    const off = within(row).getByRole("button", { name: words("admin.switch.turn-off", { name: words("admin.switch.signups") }) });
    expect(off).toHaveProperty("disabled", true);
    fireEvent.change(within(row).getByLabelText(words("admin.switch.reason", { name: words("admin.switch.signups") })), { target: { value: " Database at its limit " } });
    fireEvent.click(off);
    await confirm(words("admin.switch.confirm.off", { name: words("admin.switch.signups"), reason: "Database at its limit" }));
    await waitFor(() => expect(server.calls.filter((call) => call.path === "/api/admin/switches/log")).toHaveLength(2));
    expect(posts(server.calls)).toEqual([{ method: "POST", path: "/api/admin/switches", query: "", body: { name: "signups", on: false, reason: "Database at its limit" } }]);
    expect(server.calls.filter((call) => call.method === "GET" && call.path === "/api/admin/switches")).toHaveLength(2);
    const lottery = screen.getByText(words("admin.switch.lottery")).closest("li")!;
    expect(within(lottery).getByRole("button", { name: words("admin.switch.turn-on", { name: words("admin.switch.lottery") }) })).toBeTruthy();
    expectOnlyAdminRoutes(server.calls);
  });

  test("[R-CITY-039] given the switch row, when the tab opens, then each of the five board switches is listed with its state, the joined-week board off", async () => {
    page("switches");
    await screen.findByText(words("admin.switch.signups"));
    const states = (["boards.this-week.everyone", "boards.this-week.friends", "boards.all-time.everyone", "boards.all-time.friends", "boards.joined-week"] as const).map((name) => {
      const row = screen.getByText(words(`admin.switch.${name}`)).closest("li")!;
      expect(row.getAttribute("data-switch")).toBe(name);
      return within(row).queryByText(words("admin.switch.on")) === null ? "off" : "on";
    });
    expect(states).toEqual(["on", "on", "on", "on", "off"]);
  });

  test("[R-SERVER-031] given the switch log, when the tab opens, then every change shows with who, when and why, oldest first", async () => {
    page("switches");
    const log = await screen.findByRole("table", { name: words("admin.switch.log") });
    expect(within(log).getAllByRole("row").slice(1).map((row) => row.textContent)).toEqual([
      "2026-10-08 09:00 UTCaccount.ownerlottery offDraw audit",
      "2026-10-08 10:00 UTCaccount.ownerplaceTarget place.ojuelegba 40Busy evening",
    ]);
  });

  test("[R-SERVER-030] given the dials, when one is set at 0 and one unset, then each is confirmed and sent with its reason; a value that is not a whole number cannot be sent; there is no top-up dial", async () => {
    const server = page("switches", { "POST /api/admin/dials": () => ADMIN_GETS["/api/admin/switches"] });
    const months = (await screen.findByText(words("admin.dial.computerAfterMonths"))).closest("li")!;
    expect(within(months).getByText("25")).toBeTruthy();
    expect(screen.queryByText(/top-up/i)).toBeNull();
    const value = within(months).getByLabelText(`${words("admin.dial.value")}: ${words("admin.dial.computerAfterMonths")}`);
    fireEvent.change(within(months).getByLabelText(`${words("admin.dial.reason")}: ${words("admin.dial.computerAfterMonths")}`), { target: { value: "Quiet week" } });
    fireEvent.change(value, { target: { value: "-1" } });
    expect(within(months).getByRole("button", { name: words("admin.dial.set") })).toHaveProperty("disabled", true);
    fireEvent.change(value, { target: { value: "0" } });
    fireEvent.click(within(months).getByRole("button", { name: words("admin.dial.set") }));
    await confirm(words("admin.dial.confirm", { dial: words("admin.dial.computerAfterMonths"), value: 0, reason: "Quiet week" }));
    await waitFor(() => expect(posts(server.calls)).toHaveLength(1));
    const place = screen.getByText(words("admin.dial.placeTarget")).closest("li")!;
    fireEvent.change(within(place).getByLabelText(words("admin.dial.place")), { target: { value: "place.ojuelegba" } });
    expect(within(place).getByText("40")).toBeTruthy();
    fireEvent.change(within(place).getByLabelText(`${words("admin.dial.reason")}: ${words("admin.dial.placeTarget")}`), { target: { value: "Back to normal" } });
    fireEvent.click(within(place).getByRole("button", { name: words("admin.dial.clear") }));
    await confirm(words("admin.dial.confirm.place.unset", { dial: words("admin.dial.placeTarget"), place: "place.ojuelegba", reason: "Back to normal" }));
    await waitFor(() => expect(posts(server.calls)).toHaveLength(2));
    expect(posts(server.calls).map((call) => call.body)).toEqual([
      { dial: "computerAfterMonths", value: 0, reason: "Quiet week" },
      { dial: "placeTarget", place: "place.ojuelegba", value: null, reason: "Back to normal" },
    ]);
  });
});
