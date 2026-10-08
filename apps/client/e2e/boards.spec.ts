import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

// The boards (docs/rules/city.md R-CITY-039, R-CITY-040) on the client built
// against a server, every /api route faked here in the shapes
// apps/client/src/features/boards/boards.ts copies from the server.
import { content } from "../../../packages/content/src/index";
import { start } from "../../../packages/sim/src/testing/play";

const ONLINE = `http://localhost:${process.env.E2E_ONLINE_PORT ?? "5180"}`;
test.use({ baseURL: ONLINE, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

const PREVIEW = process.env.PREVIEW_DIR;
const CLOCK = { tick: 3, nextTickAt: Date.now() + 3_600_000, nextTurnAt: null };
const NAMES = ["Zainab", "Tunde", "Ngozi", "Ada", "Tunde", "Zainab", "Ngozi", "Ada", "Tunde", "Ngozi"];

type Row = { rank: number; firstName: string; figure: number; me: boolean; name: string | null };

function rows(figures: number[], me: number | null, names: (string | null)[] = []): Row[] {
  return figures.map((figure, at) => ({ rank: at + 1, firstName: NAMES[at] ?? "Ada", figure, me: at === me, name: names[at] ?? null }));
}

function reply(board: string, lines: Row[], own: Row | null) {
  return { body: { ok: true, board, size: 50, rows: lines, own } };
}

const BOARDS: Record<string, { body: unknown; status?: number }> = {
  "GET /api/boards/this-week/everyone": reply("this-week.everyone", rows([31, 26, 22, 19, 17, 15, 12, 11, 9, 8], null), { rank: 14, firstName: "Ada", figure: 6, me: true, name: null }),
  "GET /api/boards/all-time/everyone": reply("all-time.everyone", rows([92, 88, 85, 81, 79, 77, 74, 72, 70, 69], null), { rank: 212, firstName: "Ada", figure: 41, me: true, name: null }),
  "GET /api/boards/this-week/friends": reply("this-week.friends", [
    { rank: 1, firstName: "Tunde", figure: 9, me: false, name: "tunde.k" },
    { rank: 2, firstName: "Ada", figure: 6, me: true, name: "ada_from_yaba" },
    { rank: 3, firstName: "Ngozi", figure: 0, me: false, name: "ngozi_o" },
  ], { rank: 2, firstName: "Ada", figure: 6, me: true, name: "ada_from_yaba" }),
  "GET /api/boards/all-time/friends": reply("all-time.friends", [
    { rank: 1, firstName: "Ngozi", figure: 63, me: false, name: "ngozi_o" },
    { rank: 2, firstName: "Ada", figure: 41, me: true, name: "ada_from_yaba" },
    { rank: 3, firstName: "Tunde", figure: 38, me: false, name: "tunde.k" },
  ], { rank: 2, firstName: "Ada", figure: 41, me: true, name: "ada_from_yaba" }),
  "GET /api/boards/joined-week": { status: 503, body: { ok: false, code: "switched-off", detail: "This board is paused.", retryAfter: 30 } },
};

async function fakeServer(page: Page, answers: Record<string, { body: unknown; status?: number }>): Promise<void> {
  await page.route(
    (url) => url.pathname.startsWith("/api/"),
    (route) => {
      const request = route.request();
      const answer = answers[`${request.method()} ${new URL(request.url()).pathname}`];
      if (answer === undefined) return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ ok: false, code: "unknown-id", detail: "not faked" }) });
      return route.fulfill({ status: answer.status ?? 200, contentType: "application/json", body: JSON.stringify(answer.body) });
    },
  );
  await page.routeWebSocket(/\/api\/place\/.+\/socket$/, () => undefined);
}

test("[R-CITY-039] the four boards behind the two pickers, each with the player's own line, and the joined-week board unseen while it is off", async ({ page }, info) => {
  test.skip(!info.project.name.startsWith("Pixel"), "pictures at phone size only");
  const game = start({ scenario: "scenario.ada", content });
  game.grant(1);
  await fakeServer(page, { "GET /api/view": { body: { ok: true, view: game.view(), lines: [], clock: CLOCK } }, ...BOARDS });
  await page.goto("/?classic");
  await expect(page.getByRole("heading", { name: /^Month \d+$/ }).first()).toBeVisible({ timeout: 20_000 });
  const tabs = page.getByRole("navigation", { name: "Sections" });
  if (await tabs.isVisible()) await tabs.getByRole("button", { name: "People" }).click();
  const boards = page.locator("[data-boards]");
  await expect(boards).toBeVisible();
  await expect(page.locator("[data-joined-week]")).toHaveCount(0);

  for (const [when, whenWords] of [["this-week", "This week"], ["all-time", "All time"]] as const) {
    for (const [who, whoWords] of [["everyone", "Everyone"], ["friends", "Friends"]] as const) {
      await boards.getByRole("radio", { name: whenWords }).click();
      await boards.getByRole("radio", { name: whoWords }).click();
      const list = page.locator(`[data-board="${when}.${who}"]`);
      await expect(list).toBeVisible();
      await expect(list.locator("[data-me]")).toHaveCount(1);
      // The header is fixed over the top of a phone's screen, so the pickers are brought just under it.
      await boards.evaluate((element) => window.scrollBy(0, element.getBoundingClientRect().top - 72));
      if (PREVIEW !== undefined && PREVIEW !== "") await page.screenshot({ path: join(PREVIEW, `board-${when}-${who}-phone.png`) });
    }
  }
});
