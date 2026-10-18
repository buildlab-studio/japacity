// The Numbers tab (analytics.md R-ANALYTICS-009, 012, 13): the live numbers from the admin's stats
// route, laid out as the server made them, every small count only "fewer than", every hidden share "hidden".
import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { api, type Fetch } from "../../shared/net/http";
// Registers Testing Library's cleanup for this file.
import "../../shared/testing/render";
import { ADMIN_GETS, STATS } from "./admin.testing";
import { words } from "./admin.words";
import { ADMIN_TABS, AdminPage } from "./AdminPage";
import { adminApi } from "./api";

const BASE = "http://admin.test";

function numbersTab(): string[] {
  const paths: string[] = [];
  const fetch: Fetch = (input) => {
    const url = new URL(input);
    paths.push(url.pathname);
    const answer = ADMIN_GETS[url.pathname];
    return Promise.resolve(answer === undefined ? new Response("404 Not Found", { status: 404 }) : Response.json(answer));
  };
  render(<AdminPage api={adminApi(api({ baseUrl: BASE, fetch }), BASE)} tab="numbers" />);
  return paths;
}

const table = (caption: string) => screen.getByRole("table", { name: caption });
const cells = (row: HTMLElement) => within(row).getAllByRole("cell").map((cell) => cell.textContent);
const rowOf = (caption: string, first: string) => {
  const found = within(table(caption)).getAllByRole("row").find((row) => row.textContent?.startsWith(first));
  if (found === undefined) throw new Error(`No row ${first} in ${caption}.`);
  return found;
};

describe("the Numbers tab", () => {
  test("[R-ANALYTICS-009] given the admin page, when its tabs are read, then Numbers sits beside Analytics", () => {
    expect(ADMIN_TABS.slice(ADMIN_TABS.indexOf("analytics"), ADMIN_TABS.indexOf("analytics") + 2)).toEqual(["analytics", "numbers"]);
  });

  test("[R-ANALYTICS-012] [R-ANALYTICS-010] given the stats route's answer, when the tab opens, then online now, the periods, the funnel in order and the economy show, a small count only as fewer than and a hidden share as hidden, from the stats route alone", async () => {
    const paths = numbersTab();
    await screen.findByText(words("admin.numbers.read", { at: "2026-10-08 12:00 UTC", to: "2026-10-07" }));
    expect(paths.filter((path) => path !== "/api/account")).toEqual(["/api/admin/stats"]);

    expect(cells(rowOf(words("admin.numbers.online"), words("admin.numbers.all")))).toEqual([words("admin.numbers.all"), "23"]);
    expect(cells(rowOf(words("admin.numbers.online"), "GB"))).toEqual(["GB", words("admin.analytics.fewer", { count: 10 })]);
    expect(cells(rowOf(words("admin.numbers.periods"), words("admin.numbers.players")))).toEqual([words("admin.numbers.players"), "64", "210", "520"]);
    expect(cells(rowOf(words("admin.numbers.periods"), words("admin.numbers.dailyOverPeriodBp")))).toEqual([words("admin.numbers.dailyOverPeriodBp"), words("admin.analytics.hidden"), "22%", "22%"]);
    expect(cells(rowOf(words("admin.numbers.periods"), words("admin.numbers.topUpKobo")))[1]).toBe(words("admin.analytics.hidden"));

    const funnel = within(table(words("admin.numbers.funnel", { from: "2026-09-08", to: "2026-10-07" }))).getAllByRole("row").slice(1);
    expect(funnel.map((row) => cells(row)[0])).toEqual(STATS.ok ? STATS.stats.funnel.steps.map((step) => step.step) : []);
    expect(cells(rowOf(words("admin.numbers.economy", { day: "2026-10-07" }), "1-3"))).toEqual(["1-3", words("admin.analytics.fewer", { count: 10 }), "140", words("admin.analytics.fewer", { count: 10 }), words("admin.analytics.fewer", { count: 10 })]);
  });

  test("[R-ANALYTICS-012] given the page's copy of the reply, when its sections are read, then they are the server's eleven, in its order", () => {
    expect(STATS.ok && Object.keys(STATS.stats)).toEqual(["now", "today", "last7", "last30", "totals", "funnel", "retention", "sessions", "shares", "adverts", "economy"]);
  });
});
