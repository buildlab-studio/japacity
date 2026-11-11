// The figures (admin:period-is-today-7-or-30, admin:titles-and-values, analytics:dashboard-shows-fixed-list,
// analytics:admin-stats-for-admins-only, analytics:day-one-and-seven-return, analytics:small-counts-shown-as-fewer): the
// stats route and the dashboard laid out on Overview, Players and Money, every small count only "<" its floor, every
// hidden share "No data", a date as its day and month, a time in West Africa Time.
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { api, type Fetch } from "../../shared/net/http";
// Registers Testing Library's cleanup for this file.
import "../../shared/testing/render";
import { changeWords, dayWords, rateWords, shownCount, timeWords, whenWords } from "./admin.format";
import { ADMIN_GETS, STATS } from "./admin.testing";
import { words } from "./admin.words";
import { AdminPage, type AdminSection } from "./AdminPage";
import { adminApi } from "./api";

const BASE = "http://admin.test";
const NOW = Date.parse("2026-10-08T12:00:00Z");

function section(tab: AdminSection): string[] {
  const paths: string[] = [];
  const fetch: Fetch = (input) => {
    const url = new URL(input);
    paths.push(`${url.pathname}${url.search}`);
    const answer = ADMIN_GETS[url.pathname];
    return Promise.resolve(answer === undefined ? new Response("404 Not Found", { status: 404 }) : Response.json(answer));
  };
  render(<AdminPage api={adminApi(api({ baseUrl: BASE, fetch }), BASE)} tab={tab} />);
  return paths;
}

const stat = (label: string) => screen.getByRole("group", { name: label });
const figure = (label: string) => stat(label).querySelector("span:nth-child(2)")?.textContent;
const cells = (row: HTMLElement) => within(row).getAllByRole("cell").map((cell) => cell.textContent);

describe("the words of a figure", () => {
  test("[admin:titles-and-values] given a hidden count, a hidden share, a day and a time, then they read as the floor, No data, the day and month, and West Africa Time", () => {
    expect(shownCount({ fewerThan: 10 })).toBe("<10");
    expect(shownCount(1234)).toBe("1,234");
    expect(rateWords(null)).toBe(words("admin.no-data"));
    expect(rateWords(4380)).toBe("43.8%");
    expect(dayWords("2026-10-07")).toBe("7 Oct");
    expect(dayWords("2026-10-07", true)).toBe("7 Oct 2026");
    expect(whenWords(NOW)).toBe("8 Oct 2026 13:00 WAT");
    expect(timeWords(NOW)).toBe("13:00 WAT");
    expect(changeWords(122, 121)).toBe("+1%");
    expect(changeWords(100, 125)).toBe("-20%");
    expect(changeWords(null, 5)).toBeNull();
    expect(changeWords(5, 0)).toBeNull();
  });
});

describe("Overview", () => {
  test("[admin:period-is-today-7-or-30] [analytics:admin-stats-for-admins-only] given the stats and the dashboard, when the period is picked, then each card shows that period's figure with its change against the period before where the daily rows hold one", async () => {
    section("overview");
    await screen.findByRole("group", { name: words("admin.figure.players") });
    const picker = screen.getByRole("group", { name: words("admin.period") });
    expect(within(picker).getAllByRole("button").map((button) => button.textContent)).toEqual([words("admin.period.today"), words("admin.period.last7"), words("admin.period.last30")]);
    expect(within(picker).getByRole("button", { name: words("admin.period.last7") }).getAttribute("aria-pressed")).toBe("true");
    expect(figure(words("admin.figure.players"))).toBe("210");
    // Three daily rows hold no two whole weeks, so the 7-day card has no change to show.
    await waitFor(() => expect(stat(words("admin.figure.players")).textContent).toContain(words("admin.change.none")));
    fireEvent.click(within(picker).getByRole("button", { name: words("admin.period.today") }));
    expect(figure(words("admin.figure.players"))).toBe("64");
    expect(stat(words("admin.figure.players")).textContent).toContain("+1%");
    fireEvent.click(within(picker).getByRole("button", { name: words("admin.period.last30") }));
    expect(figure(words("admin.figure.players"))).toBe("520");
    expect(figure(words("admin.figure.online"))).toBe("23");
    expect(stat(words("admin.figure.online")).textContent).toContain("41");
    expect(figure(words("admin.figure.d1"))).toBe("32.1%");
  });

  test("[admin:sections-alarms-first] given the queue, the lights, the campaigns and the feedback, when Overview opens, then what waits for a person shows as counts that open their sections", async () => {
    section("overview");
    const waiting = await screen.findByRole("list", { name: words("admin.waiting") });
    await waitFor(() => expect(within(waiting).getAllByRole("button").map((tile) => tile.textContent)).toEqual([`2${words("admin.waiting.reports")}`, `1${words("admin.waiting.appeals")}`, `2${words("admin.waiting.lights")}`, `1${words("admin.waiting.adverts")}`, `1${words("admin.waiting.feedback")}`]));
    fireEvent.click(within(waiting).getByRole("button", { name: `1${words("admin.waiting.adverts")}` }));
    expect(screen.getByRole("tab", { name: /^Adverts/ }).getAttribute("aria-selected")).toBe("true");
  });

  test("[analytics:dashboard-shows-fixed-list] given the dashboard, when Overview opens, then players a day is drawn as a chart from its daily rows", async () => {
    section("overview");
    expect(await screen.findByRole("img", { name: words("admin.chart.players") })).toBeTruthy();
  });
});

describe("Players", () => {
  test("[analytics:dashboard-shows-fixed-list] [analytics:small-counts-shown-as-fewer] [analytics:admin-stats-for-admins-only] given the stats and the dashboard, when Players opens, then the funnel, the sessions and the first good moment show as bars, a small count only as the floor, from the two routes alone", async () => {
    const paths = section("players");
    await screen.findByRole("table", { name: words("admin.funnel") });
    expect(paths.filter((path) => !path.startsWith("/api/account")).sort()).toEqual(["/api/admin/adverts/campaigns", "/api/admin/analytics", "/api/admin/checks", "/api/admin/moderation/queue", "/api/admin/stats"]);
    const funnel = within(screen.getByRole("table", { name: words("admin.funnel") })).getAllByRole("row").slice(1);
    expect(funnel.map((row) => cells(row)[0])).toEqual(STATS.ok ? STATS.stats.funnel.steps.map((step) => words(`admin.funnel.${step.step}` as "admin.funnel.begin")) : []);
    expect(cells(funnel[3]!)).toEqual([words("admin.funnel.begin"), "", "600 (73.2%)"]);
    const early = within(screen.getByRole("table", { name: words("admin.early") })).getAllByRole("row").slice(1);
    expect(early.map((row) => [cells(row)[0], cells(row)[2]])).toEqual([
      [words("admin.early.1"), "101"],
      [words("admin.early.2"), "75"],
      [words("admin.early.3"), "<10"],
      [words("admin.early.later"), "<10"],
      [words("admin.early.none"), "<10"],
    ]);
    expect(screen.getByText(words("admin.early.asked", { count: "3", days: "8 Oct" })).getAttribute("data-asked-early")).toBe("alarm");
    expect(figure(words("admin.figure.accounts"))).toBe("1,240");
  });

  test("[analytics:day-one-and-seven-return] given the sign-up weeks, when Players opens, then day 1 and day 7 show beside the reference lines, marked under or over them, and a hidden rate reads No data", async () => {
    section("players");
    const table = await screen.findByRole("table", { name: words("admin.return") });
    const [week] = within(table).getAllByRole("row").slice(1);
    expect(cells(week!)).toEqual(["28 Sep", "280", "32.1% (90)", "21.4% (60)", "10.7% (30)", words("admin.no-data"), words("admin.no-data"), "25% (70)"]);
    const marks = [...week!.querySelectorAll("[data-line]")].map((cell) => cell.getAttribute("data-line"));
    expect(marks).toEqual(["under", "none", "under", "hidden", "hidden", "none"]);
    expect(screen.getByText(words("admin.return.lines", { d1: "40%", d7: "15%" }))).toBeTruthy();
  });

  test("[analytics:dashboard-shows-fixed-list] given a day typed, when it is shown, then the dashboard for that day is asked", async () => {
    const paths = section("players");
    await screen.findByRole("table", { name: words("admin.funnel") });
    fireEvent.change(screen.getByLabelText(words("admin.asof")), { target: { value: "2026-10-01" } });
    fireEvent.click(screen.getByRole("button", { name: words("admin.show") }));
    await waitFor(() => expect(paths.filter((path) => path.startsWith("/api/admin/analytics"))).toEqual(["/api/admin/analytics", "/api/admin/analytics?day=2026-10-01"]));
  });
});

describe("Money", () => {
  test("[analytics:admin-stats-for-admins-only] [analytics:small-counts-shown-as-fewer] given the stats, when Money opens, then the economy shows as a grid of lives by month played and naira held, a small count only as the floor", async () => {
    section("money");
    const grid = await screen.findByRole("table", { name: words("admin.economy") });
    const rows = within(grid).getAllByRole("row").slice(1);
    expect(rows.map((row) => within(row).getByRole("rowheader").textContent)).toEqual([words("admin.months.1-3"), words("admin.months.4-12"), words("admin.months.13+")]);
    expect(cells(rows[0]!)).toEqual(["<10", "140", "<10", "<10"]);
    expect(figure(words("admin.figure.topUps"))).toBe("<10");
  });
});
