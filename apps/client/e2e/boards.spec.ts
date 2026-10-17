import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

// The boards (docs/rules/city.md R-CITY-039, R-CITY-040) on the client built
// against a server, every /api route faked here in the shapes
// apps/client/src/features/boards/boards.ts copies from the server.
import { content } from "../../../packages/content/src/index";
import { start } from "../../../packages/sim/src/testing/play";
import { passOpeningWords } from "./door";
import { openApp, passCards, passHomeTeach, placeReady } from "./live";

const ONLINE = `http://localhost:${process.env.E2E_ONLINE_PORT ?? "5180"}`;
// The world's scene needs WebGL, drawn in software where the machine has no GPU (as world.spec.ts draws it).
test.use({ baseURL: ONLINE, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] } });

const PREVIEW = process.env.PREVIEW_DIR;
const CLOCK = { tick: 3, nextTickAt: Date.now() + 3_600_000, nextTurnAt: null };
// R-CITY-040: every board names each line by the account's username, friends too.
const USERNAMES = ["zainab_b", "tunde_k", "ngozi_o", "ada_ikeja", "tunde_99", "zee_lagos", "ngozi_writes", "ada_o", "tk_surulere", "ngo_yaba"];

type Row = { rank: number; username: string | null; figure: number; me: boolean };

function rows(figures: number[], me: number | null): Row[] {
  return figures.map((figure, at) => ({ rank: at + 1, username: USERNAMES[at] ?? "ada_from_yaba", figure, me: at === me }));
}

function friend(rank: number, username: string, figure: number, me = false): Row {
  return { rank, username, figure, me };
}

function reply(board: string, lines: Row[], own: Row | null) {
  return { body: { ok: true, board, size: 50, rows: lines, own } };
}

const BOARDS: Record<string, { body: unknown; status?: number }> = {
  "GET /api/boards/this-week/everyone": reply("this-week.everyone", rows([31, 26, 22, 19, 17, 15, 12, 11, 9, 8], null), { rank: 14, username: "ada_from_yaba", figure: 6, me: true }),
  "GET /api/boards/all-time/everyone": reply("all-time.everyone", rows([92, 88, 85, 81, 79, 77, 74, 72, 70, 69], null), { rank: 212, username: "ada_from_yaba", figure: 41, me: true }),
  "GET /api/boards/this-week/friends": reply(
    "this-week.friends",
    [friend(1, "tunde_k", 9), friend(2, "ada_from_yaba", 6, true), friend(3, "ngozi_o", 0)],
    friend(2, "ada_from_yaba", 6, true),
  ),
  "GET /api/boards/all-time/friends": reply(
    "all-time.friends",
    [friend(1, "ngozi_o", 63), friend(2, "ada_from_yaba", 41, true), friend(3, "tunde_k", 38)],
    friend(2, "ada_from_yaba", 41, true),
  ),
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
  test.setTimeout(150_000);
  await page.addInitScript(() => localStorage.setItem("japacity.walkthrough", "1"));
  await page.goto("/");
  await expect(page.locator("[data-band]")).toBeVisible({ timeout: 60_000 });
  await passOpeningWords(page);
  await placeReady(page);
  await passCards(page);
  await passHomeTeach(page);
  // The boards stand with the people in the phone's Chats.
  const chats = await openApp(page, "chats");
  await chats.locator('[data-chat-row="people"]').click();
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
      // R-CITY-040: the player's own line names the username on every board, and nothing else names it.
      await expect(list.locator("[data-me] [data-board-name]")).toHaveText("ada_from_yaba");
      await expect(list.locator("[data-me]")).not.toContainText("Ada");
      await boards.scrollIntoViewIfNeeded();
      if (PREVIEW !== undefined && PREVIEW !== "") await page.screenshot({ path: join(PREVIEW, `board-${when}-${who}-phone.png`) });
    }
  }
});
