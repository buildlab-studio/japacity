import { expect, test, type Page } from "@playwright/test";

// Nothing is asked of the player before the early win (docs/rules/guides.md
// R-GUIDE-015). A new life is played online against a faked server that runs
// the simulation itself, month by month as the view's next step suggests
// (R-GUIDE-014), and every screen before the first good line is searched for
// an ask.
import { content, text } from "../../../packages/content/src/index";
import type { Command, Id, PlayerView, ReportLine } from "../../../packages/sim/src/engine/types";
import { start, type Game } from "../../../packages/sim/src/testing/play";
import { chapterNextStep, FIRST_SESSION_TURNS } from "../src/shared/testing/firstSession";
import { startReadyLife } from "./door";

const ONLINE = `http://localhost:${process.env.E2E_ONLINE_PORT ?? "5180"}`;
test.use({ baseURL: ONLINE });

const SCENARIO: Id<"scenario"> = "scenario.tunde";
/** A public key in the shape the browser takes; the faked server never pushes. */
const PUSH_KEY = "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U";

interface Faked {
  game: () => Game | null;
  /** The lines of the last command the faked server accepted, as the simulation gave them. */
  lines: () => ReportLine[];
}

function clock(game: Game) {
  return { tick: game.tick, nextTickAt: Date.now() + 3_600_000, nextTurnAt: null };
}

/** The view with a month banked, as the server's clock would have it. */
function viewOf(game: Game): { ok: true; view: PlayerView; lines: ReportLine[]; clock: ReturnType<typeof clock> } {
  if (game.state.turn.banked === 0) game.grant(1);
  return { ok: true, view: game.view(), lines: [], clock: clock(game) };
}

/** Every /api route the client calls, answered from a game the faked server holds; the nudge socket opens and stays quiet. */
async function fakeServer(page: Page): Promise<Faked> {
  let game: Game | null = null;
  let lines: ReportLine[] = [];
  const json = (body: unknown, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });
  await page.route(
    (url) => url.pathname.startsWith("/api/"),
    async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      const asked = `${request.method()} ${path}`;
      if (asked === "GET /api/view") {
        if (game === null) return route.fulfill(json({ ok: false, code: "no-character", detail: "No character yet." }, 404));
        return route.fulfill(json(viewOf(game)));
      }
      if (asked === "POST /api/character") {
        const { scenario } = request.postDataJSON() as { scenario: Id<"scenario"> };
        game = start({ scenario, content });
        return route.fulfill(json(viewOf(game)));
      }
      if (asked === "POST /api/command" && game !== null) {
        const { command } = request.postDataJSON() as { command: Command };
        // The handle bases every command on its own state, as the server's version check would.
        const result = game.send(command);
        if (!result.ok) return route.fulfill(json({ ok: false, code: result.code, detail: result.detail }, 409));
        lines = result.lines;
        return route.fulfill(json({ ...viewOf(game), lines }));
      }
      if (asked === "GET /api/account") {
        return route.fulfill(json({ ok: true, account: { id: "account-1", country: "NG", age: { passed: true, method: "declared" }, createdAt: 1, character: "c-1", sendUsageCounts: true, admin: false } }));
      }
      if (asked === "GET /api/notify") return route.fulfill(json({ ok: true, on: false, reaskDays: 7 }));
      if (asked === "GET /api/notify/key") return route.fulfill(json({ ok: true, key: PUSH_KEY }));
      return route.fulfill(json({ ok: false, code: "unknown-id", detail: "not faked" }, 404));
    },
  );
  await page.routeWebSocket(/\/api\/place\/.+\/socket$/, () => undefined);
  // The browser has neither agreed to notices nor refused them, as on a first visit.
  await page.addInitScript(() => {
    Object.defineProperty(Notification, "permission", { get: () => "default" });
  });
  return { game: () => game, lines: () => lines };
}

/** Every ask R-GUIDE-015 names that the shell holds back: a sign-in method, the notice, a share, an invite. */
const ASKS = {
  "sign-in": (page: Page) => page.getByRole("button", { name: "Continue with Google" }),
  notify: (page: Page) => page.getByRole("dialog", { name: "Know when your turns are full" }),
  share: (page: Page) => page.locator("[data-share-button], [data-card-tile]"),
  // The card maker for the partner slot, the sibling's invite and the card's link, in the DOM whether or not their tab shows.
  invite: (page: Page) => page.locator('form[aria-label="Ask a friend"], [data-slot] button:text-is("Ask a friend to be this sibling"), button:text-is("Get the link")'),
};

/**
 * `winShown`: the lines on screen carry the early win, so the asks the store
 * releases with it (the invite) may be in the page; the shell's own asks still wait.
 */
async function expectNoAsk(page: Page, when: string, winShown = false): Promise<void> {
  for (const [ask, find] of Object.entries(ASKS)) {
    if (winShown && ask === "invite") continue;
    await expect(find(page), `${ask} asked ${when}`).toHaveCount(0);
  }
}

function nameOf(id: string): string {
  const said = text[`${id}.name`];
  if (said === undefined) throw new Error(`No name for ${id}`);
  return said;
}

/** Puts the view's next step in the plan through the activity cards. */
async function planNextStep(page: Page, game: Game): Promise<void> {
  for (const pick of chapterNextStep(game.view(), content)) {
    if (pick.param !== null && pick.activity === "activity.job-hunt") await page.locator(`[role="radio"][data-job="${pick.param}"]`).click();
    else if (pick.param !== null) await page.locator(`[id="param-${pick.activity}"]`).selectOption(pick.param);
    await page.getByRole("button", { name: `Add to month: ${nameOf(pick.activity)}` }).click();
  }
}

test("[R-GUIDE-015] [R-GUIDE-014] a new life played online as the next step suggests is asked nothing before its first good line, and the asks come after it", async ({ page }) => {
  const server = await fakeServer(page);
  await page.goto("/?classic");

  await expect(page.getByRole("heading", { name: "Who are you?" })).toBeVisible({ timeout: 20_000 });
  await expectNoAsk(page, "on the life chooser");
  await startReadyLife(page, text[`${SCENARIO}.kind`]);
  await expect(page.getByRole("heading", { name: "Month 1", exact: true })).toBeVisible();

  let won = false;
  let shareShown = false;
  for (let month = 1; month <= FIRST_SESSION_TURNS; month += 1) {
    const game = server.game();
    if (game === null) throw new Error("The faked server holds no game.");
    const before = !won;
    if (before) await expectNoAsk(page, `before month ${String(month)} ends`);
    await planNextStep(page, game);
    if (before) await expectNoAsk(page, `with month ${String(month)} planned`);
    await page.getByRole("button", { name: "End month" }).click();

    // The staged wins come first, then the report: none of them is an ask.
    await expect(page.getByRole("dialog")).toBeVisible();
    const winShown = server.lines().some((line) => line.tone === "good");
    const carryOn = page.getByRole("button", { name: /^(Carry on|Next)$/ });
    for (let shown = 0; shown < 5 && (await carryOn.isVisible()); shown += 1) {
      if (before) await expectNoAsk(page, `on a staged moment of month ${String(month)}`, winShown);
      await carryOn.click();
    }
    const report = page.getByRole("dialog");
    await expect(report.getByRole("heading", { name: `Month ${String(month)}` })).toBeVisible();
    if (before) await expectNoAsk(page, `in the report of month ${String(month)}`, winShown);
    won ||= server.lines().some((line) => line.tone === "good");
    await report.getByRole("button", { name: "Close" }).click();

    if (before && won) {
      // The first salary is the early win and a good moment: the notice is asked once the report is closed.
      await expect(ASKS.notify(page)).toBeVisible();
      await ASKS.notify(page).getByRole("button", { name: "Not now" }).click();
      await expect(ASKS.notify(page)).toHaveCount(0);
    }
    const card = page.locator("[data-share-card]");
    if (await card.isVisible()) {
      // A card due after the early win opens on its own, with its share button.
      await expect(page.locator("[data-share-button]")).toBeVisible();
      shareShown = true;
      await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
    }
    await expect(page.getByRole("heading", { name: `Month ${String(month + 1)}`, exact: true })).toBeVisible();
  }
  expect(won, "an early win within the first three months").toBe(true);

  // The chapter closed in the second month, after the early win: its card came with its share button.
  expect(shareShown, "the chapter's card offered to share after the early win").toBe(true);
  await expect(ASKS["sign-in"](page)).toHaveCount(0);
  // After the early win the invite is offered on the people tab.
  expect(await ASKS.invite(page).count(), "the invite offered after the early win").toBeGreaterThan(0);
});
