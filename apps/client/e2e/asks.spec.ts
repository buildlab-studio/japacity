import type { Command, Id, ReportLine } from "@japacity/sim";
import { FIRST_SESSION_MONTHS, start, type Game } from "@japacity/sim/testing";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, type Page } from "@playwright/test";
import { test } from "./support/policy";

// Nothing is asked of the player before the early win (docs/rules/guide.md
// guide:nothing-asked-before-early-win). A new life is played online against a faked server that runs
// the simulation itself, month by month as the view's next step suggests
// (guide:early-win-in-three-turns): each step taken at the thing in the world that stages it, the
// month slept in the bed (world:sleep-ends-the-month, world:month-passes-as-lived), and
// every screen before the first good line is searched for an ask.
import { content, text } from "../../../packages/content/src/index";
import { accountView } from "../src/shared/testing/fixtures";
import { chapterNextStep } from "../src/shared/testing/firstSession";
import { json, NO_CHARACTER, NOT_FAKED, ONLINE, quietSocket, viewReply } from "./support/api";
import { startReadyLife } from "./support/door";
import { backFromResults, doAct, LIVED, openApp, passCards, passHomeTeach, placeNow, placeReady, sleepTheMonth } from "./support/live";

test.use({ baseURL: ONLINE });

const SCENARIO: Id<"scenario"> = "scenario.banker";
/** A public key in the shape the browser takes; the faked server never pushes. */
const PUSH_KEY = "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U";

interface Faked {
  game: () => Game | null;
  /** The lines of the last command the faked server accepted, as the simulation gave them. */
  lines: () => ReportLine[];
}

/** Every /api route the client calls, answered from a game the faked server holds; the nudge socket opens and stays quiet. */
async function fakeServer(page: Page): Promise<Faked> {
  let game: Game | null = null;
  let lines: ReportLine[] = [];
  await page.route(
    (url) => url.pathname.startsWith("/api/"),
    async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      const asked = `${request.method()} ${path}`;
      if (asked === "GET /api/view") {
        if (game === null) return route.fulfill(json(NO_CHARACTER, 404));
        return route.fulfill(json(viewReply(game)));
      }
      if (asked === "POST /api/character") {
        const { scenario } = request.postDataJSON() as { scenario: Id<"scenario"> };
        game = start({ scenario, content });
        return route.fulfill(json(viewReply(game)));
      }
      if (asked === "POST /api/command" && game !== null) {
        const { command } = request.postDataJSON() as { command: Command };
        // The handle bases every command on its own state, as the server's version check would.
        const result = game.send(command);
        if (!result.ok) return route.fulfill(json({ ok: false, code: result.code, detail: result.detail }, 409));
        lines = result.lines;
        return route.fulfill(json({ ...viewReply(game), lines }));
      }
      if (asked === "GET /api/account") {
        return route.fulfill(json({ ok: true, account: accountView() }));
      }
      if (asked === "GET /api/notify") return route.fulfill(json({ ok: true, on: false, reaskDays: 7 }));
      if (asked === "GET /api/notify/key") return route.fulfill(json({ ok: true, key: PUSH_KEY }));
      return route.fulfill(json(NOT_FAKED, 404));
    },
  );
  await quietSocket(page);
  // The browser has neither agreed to notices nor refused them, as on a first visit.
  await page.addInitScript(() => {
    Object.defineProperty(Notification, "permission", { get: () => "default" });
  });
  return { game: () => game, lines: () => lines };
}

/** Every ask guide:nothing-asked-before-early-win names that the shell holds back: a sign-in method, the notice, a share, an invite. */
const ASKS = {
  "sign-in": (page: Page) => page.getByRole("button", { name: "Continue with Google" }),
  notify: (page: Page) => page.getByRole("dialog", { name: "Know when your months are full" }),
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

/** Where an activity is staged in the world: the place file, the thing and its act that stage it (world:things-are-tappable-models), read from the place files the game ships. */
function stagedAt(activity: string): { place: string; thing: string; act: string } {
  const places = join(import.meta.dirname, "..", "public", "assets", "places");
  for (const folder of readdirSync(places)) {
    const file = join(places, folder, "place.json");
    if (!existsSync(file)) continue;
    const placed = JSON.parse(readFileSync(file, "utf8")) as { place: string; stage?: { things?: { id: string; acts?: { id: string; stages?: string[] }[] }[] } };
    for (const thing of placed.stage?.things ?? []) {
      const act = (thing.acts ?? []).find((candidate) => (candidate.stages ?? []).includes(activity));
      if (act !== undefined) return { place: placed.place, thing: thing.id, act: act.id };
    }
  }
  throw new Error(`No thing in the world stages ${activity}.`);
}

/** The ride to a stop the map holds open (world:map-is-painted-lagos, world:ride-sheet-shows-fares), by the stop's button beside the painted map. */
async function rideTo(page: Page, id: string): Promise<void> {
  if ((await placeNow(page)) === id) return;
  await page.locator('[data-thumb="map"]').click();
  await page.waitForFunction(() => (window as unknown as { __map?: { ready?: boolean } }).__map?.ready === true, null, { timeout: 60_000 });
  await page.evaluate((stop) => document.querySelector<HTMLButtonElement>(`[data-stop="${stop}"]`)?.click(), id);
  await page.locator(`[data-ride-sheet="${id}"] [data-ride-main]`).click();
  await page.waitForFunction((stop) => {
    const city = (window as unknown as { __city?: { ready?: boolean; place?: string } }).__city;
    return city?.place === stop && city.ready === true;
  }, id, { timeout: 90_000 });
  await passCards(page);
}

/** Takes the view's next step in the world: at each pick's place, its thing's act, and on the act's card the param and the act (activity:now-acts-and-month-acts). */
async function takeNextStep(page: Page, game: Game): Promise<void> {
  for (const pick of chapterNextStep(game.view(), content)) {
    const at = stagedAt(pick.activity);
    await rideTo(page, at.place);
    await doAct(page, at.thing, at.act);
    const card = page.getByRole("dialog");
    if (pick.param !== null && pick.activity === "activity.job-hunt") await card.locator(`[role="radio"][data-job="${pick.param}"]`).click();
    else if (pick.param !== null) {
      // One choice shows no list: the first meetup hears of one route (guide:first-meetup-hears-fitting-route), and the card takes it.
      const route = card.locator(`[role="radio"][data-route="${pick.param}"]`);
      const select = card.locator(`[id="param-${pick.activity}"]`);
      if ((await route.count()) > 0) await route.click();
      else if ((await select.count()) > 0) await select.selectOption(pick.param);
    }
    // The act's card says its name on its main button, with the price after it where it costs.
    const named = nameOf(pick.activity).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    await card.getByRole("button", { name: new RegExp(`^${named}( · |$)`) }).last().click();
    // An answer that stands as its card is put away; any other act started at the tap with its toast (world:things-are-tappable-models).
    const done = page.getByRole("dialog").getByRole("button", { name: /^(Done|Close)$/ });
    if (await done.last().waitFor({ state: "visible", timeout: 4000 }).then(() => true, () => false)) await done.last().click();
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 15_000 });
  }
}

test("[guide:nothing-asked-before-early-win] [guide:early-win-in-three-turns] [moment:card-shows-when-outcome-lands] a new life played online as the next step suggests is asked nothing before its first good line, and the asks come after it", async ({ page }, info) => {
  // The step's thing under its marker is tapped where the scene draws it, which is measured at phone size.
  test.skip(info.project.name !== "Pixel 7", "The world is lived at phone size");
  test.setTimeout(300_000);
  const server = await fakeServer(page);
  await page.goto(`/${LIVED}`);

  await expect(page.getByRole("button", { name: /^Next/ }).first()).toBeVisible({ timeout: 20_000 });
  await expectNoAsk(page, "on the start screen");
  await startReadyLife(page, text[`${SCENARIO}.kind`]);
  await expect(page.locator("[data-band]")).toBeVisible();
  await placeReady(page);
  await passHomeTeach(page);

  let won = false;
  let shareShown = false;
  // The chapter's close told by its moment card (moment:card-shows-when-outcome-lands): never before the early win, and with no share button (moment:moment-is-not-share-card).
  let chapterTold = false;
  const chapterCard = async (): Promise<void> => {
    const told = page.locator("[data-moment-screen='chapter']");
    if (!(await told.isVisible().catch(() => false))) return;
    expect(won, "the chapter's close told after the early win").toBe(true);
    await expect(told.locator("[data-share-button]")).toHaveCount(0);
    chapterTold = true;
  };
  for (let month = 1; month <= FIRST_SESSION_MONTHS; month += 1) {
    const game = server.game();
    if (game === null) throw new Error("The faked server holds no game.");
    const before = !won;
    if (before) await expectNoAsk(page, `before month ${String(month)} is lived`);
    await takeNextStep(page, game);
    // A step taken at once (activity:now-acts-and-month-acts) may be the first good line itself: the meetup hears of a way out there and then.
    won ||= server.lines().some((line) => line.tone === "good");
    // Quiet: nothing good has happened yet, so nothing may be asked.
    const quiet = before && !won;
    if (quiet) await expectNoAsk(page, `with month ${String(month)}'s step taken`);

    // Home to the bed; the staged wins come over the results, and none of them is an ask.
    await rideTo(page, "place.family-house");
    const results = await sleepTheMonth(page, async () => {
      await chapterCard();
      if (quiet) await expectNoAsk(page, `on a staged moment of month ${String(month)}`, server.lines().some((line) => line.tone === "good"));
    });
    const winShown = server.lines().some((line) => line.tone === "good");
    if (quiet) await expectNoAsk(page, `in the results of month ${String(month)}`, winShown);
    await expect(results.getByRole("heading", { name: "The month is done" })).toBeVisible();
    won ||= server.lines().some((line) => line.tone === "good");
    await backFromResults(page);

    if (before && won) {
      // The first good line is the early win and a good moment: the notice is asked once the results are put away.
      await expect(ASKS.notify(page)).toBeVisible();
      await ASKS.notify(page).getByRole("button", { name: "Not now" }).click();
      await expect(ASKS.notify(page)).toHaveCount(0);
    }
    // The chapter's own cards over the world first (its moment, its close), each looked at for an ask while quiet.
    await passCards(page, async () => {
      await chapterCard();
      if (quiet) await expectNoAsk(page, `on a card of month ${String(month)}`, true);
    });
    const card = page.locator("[data-share-card]");
    if (await card.waitFor({ state: "visible", timeout: 4000 }).then(() => true, () => false)) {
      // A card due after the early win and told by no moment card opens on its own, with its share button.
      await expect(page.locator("[data-share-button]")).toBeVisible();
      shareShown = true;
      await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
    }
    await passCards(page);
  }
  expect(won, "an early win within the first three months").toBe(true);

  // The chapter closed after the early win, told by its moment card; its share card is kept in the gallery without opening
  // (moment:card-shows-when-outcome-lands), where it is offered to share. A share card no moment told opens with its button.
  expect(chapterTold || shareShown, "the chapter's close told after the early win").toBe(true);
  const kept = await page.evaluate(() => localStorage.getItem("japacity.cards") ?? "[]");
  expect(kept, "the chapter's card kept in the gallery after the early win").toContain("chapter.find-your-feet");
  await expect(ASKS["sign-in"](page)).toHaveCount(0);
  // After the early win the invite is offered among the people in Chats.
  const chats = await openApp(page, "chats");
  await chats.locator('[data-chat-row="people"]').click();
  expect(await ASKS.invite(page).count(), "the invite offered after the early win").toBeGreaterThan(0);
});
