import { expect, test, type Page } from "@playwright/test";

// The recorded lives are the simulation's own data, replayed here through the client's save. The month is lived in the
// world (docs/rules/world.md R-WORLD-025, R-WORLD-030): acts on the home's things, the bed's Sleep turning it, the results
// over the scene.
import { content, text } from "../../../packages/content/src/index";
import type { Id } from "../../../packages/sim/src/engine/types";
import { lifeSaves } from "../../../packages/sim/src/goldens/lives.data";
import { start } from "../../../packages/sim/src/testing/play";
import { standInWorld } from "../../../packages/sim/src/world/standIn";
import { startArchetype, startReadyLife } from "./door";
import { backFromResults, doAct, fanAct, intoTheRoom, LIVED, openApp, passCards, passHomeTeach, placeNow, placeReady, putPhoneAway, seedSave, sleepTheMonth } from "./live";

test.use({ launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] } });

/** Text that must never reach the player: kobo, a raw object, a missing value, a words key with no words. */
const BROKEN: readonly [string, RegExp][] = [
  ["kobo or pence on money", /[₦£$]\d[\d,]*\.\d/],
  ["a raw object", /\[object Object\]/],
  ["a missing value", /\bundefined\b|\bNaN\b/],
  ["a words key with no words", /\b(?:line|ui|reject)\.[a-z-]+\.[a-z-]+/],
];

// The aboki rate is the one figure that keeps its kobo, so the rates table is left out.
async function shownText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const copy = document.body.cloneNode(true) as HTMLElement;
    for (const rates of copy.querySelectorAll("[data-rates]")) rates.remove();
    return copy.textContent;
  });
}

async function expectNothingBroken(page: Page, when: string): Promise<void> {
  const shown = await shownText(page);
  for (const [what, pattern] of BROKEN) expect(shown.match(pattern)?.[0], `${what} on screen ${when}`).toBeUndefined();
}

/** The band's age, "23 yrs 2 mo": the clock a month lived moves on (R-WORLD-002). */
async function bandAge(page: Page): Promise<string> {
  const said = (await page.locator("[data-band]").textContent()) ?? "";
  return /\d+ yrs \d+ mo/.exec(said)?.[0] ?? "";
}

/** One month older than an age as the band says it. */
function aMonthOn(age: string): string {
  const [years, months] = (age.match(/\d+/g) ?? []).map(Number);
  const next = (years ?? 0) * 12 + (months ?? 0) + 1;
  return `${String(Math.floor(next / 12))} yrs ${String(next % 12)} mo`;
}

/** An act whose sheet opens over the place (R-WORLD-005): the thing's act, then the sheet's own button for the act chosen. */
async function actBySheet(page: Page, thing: string, act: string, button: RegExp): Promise<void> {
  await doAct(page, thing, act);
  const sheet = page.getByRole("dialog");
  await sheet.getByRole("button", { name: button }).last().click();
  await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 15_000 });
}

/**
 * A now-act from the fan (R-WORLD-034): it is done at once, or, when the act asks first, its card opens once the character
 * has walked to the thing and its own button (the act's name) does it. Either way the fan closes and no sheet is left.
 */
async function fanActDone(page: Page, thing: string, activity: string, button: RegExp): Promise<void> {
  const counter = page.locator("[data-band] [data-counter]");
  const before = await counter.getAttribute("data-counter");
  await fanAct(page, thing, activity);
  // The card, when the act asks first, comes once the character has walked over, which a loaded machine stretches. An act
  // already done at once (its price off the band's counter) is not bought again from a card that follows it.
  const card = page.getByRole("dialog");
  const asked = card.getByRole("button", { name: button });
  const fan = page.locator(`[data-fan="${thing}"]`);
  const ends = Date.now() + 20_000;
  let settled = false;
  while (Date.now() < ends) {
    if (await asked.last().isVisible().catch(() => false)) {
      if ((await counter.getAttribute("data-counter")) === before) await asked.last().click();
      else await card.getByRole("button", { name: "Close" }).first().click();
      if (settled) break;
      settled = true;
    } else if ((await fan.count()) === 0 && (await card.count()) === 0) {
      if (settled) break;
      // A beat more, in case a card is still on its way: on a loaded machine the scene's second report of the walk's end
      // can open the act's card seconds after the act was done (open: City.tsx's fan walk, fanGoing).
      settled = true;
      await asked.last().waitFor({ state: "visible", timeout: 8000 }).catch(() => undefined);
      continue;
    }
    await page.waitForTimeout(250);
  }
  await expect(card).toHaveCount(0, { timeout: 15_000 });
  await expect(fan).toHaveCount(0, { timeout: 10_000 });
}

test("a new player picks a life, lives a month and reads its results", async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto(`/${LIVED}`);

  // A fresh browser has no save, so the start screen and the door come first.
  await expect(page.getByRole("button", { name: /^Next/ }).first()).toBeVisible({ timeout: 20_000 });
  await startReadyLife(page);
  await expect(page.locator("[data-band]")).toBeVisible();
  await placeReady(page);
  await passHomeTeach(page);
  const age = await bandAge(page);
  expect(age).not.toBe("");

  const results = await sleepTheMonth(page);
  await expect(results.getByRole("heading", { name: "The month is done" })).toBeVisible();
  await expect(results.locator("[data-results-kept]")).toBeVisible();
  await expect(results).toContainText(aMonthOn(age));
  await backFromResults(page);
  expect(await bandAge(page)).toBe(aMonthOn(age));

  // The life survives a reload.
  await page.reload();
  await expect(page.locator("[data-band]")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("[data-band]")).toContainText(aMonthOn(age));
});

test("[R-WORLD-034] three months of play, acts from the fan and from the things' sheets, show no kobo, raw object, missing value or bare key", async ({ page }, info) => {
  test.skip(info.project.name !== "Pixel 7", "The month's acts are tapped at phone size");
  test.setTimeout(300_000);
  await page.goto(`/${LIVED}`);
  await startReadyLife(page);
  await placeReady(page);
  await passHomeTeach(page);
  await expectNothingBroken(page, "at the start");
  await intoTheRoom(page);

  // Each month, acts on the home's things: from the fan (R-WORLD-034) and from a thing's sheet (R-WORLD-005).
  const months: ((page: Page) => Promise<void>)[] = [
    async (here) => {
      await fanActDone(here, "cooking", "activity.cook-at-home", /^Indomie and egg/);
      await actBySheet(here, "table", "study", /^Study for the English test/);
    },
    async (here) => {
      await actBySheet(here, "mama", "family-time", /^Time with family/);
      await fanActDone(here, "drum", "activity.fetch-water", /^Fetch water/);
    },
    async (here) => {
      await fanActDone(here, "tv", "activity.watch-tv", /^Nollywood with Papa/);
      await fanActDone(here, "drum", "activity.bucket-bath", /^Bucket bath/);
    },
  ];
  for (const [index, play] of months.entries()) {
    const month = index + 1;
    await play(page);
    await expectNothingBroken(page, `after the acts of month ${String(month)}`);
    const results = await sleepTheMonth(page);
    await expect(results.getByRole("heading", { name: "The month is done" })).toBeVisible();
    await expectNothingBroken(page, `in the results of month ${String(month)}`);
    await backFromResults(page);
    // What was started carries on into the next month by itself (R-WORLD-007): the Calendar says it, with no Same again.
    await page.locator("[data-band-month]").click();
    const calendar = page.locator("[data-app-screen='calendar']");
    await expect(calendar.locator("[data-calendar]").first()).toBeVisible();
    await expect(calendar.getByRole("button", { name: "Same again" })).toHaveCount(0);
    await expectNothingBroken(page, `in the Calendar of month ${String(month + 1)}`);
    await putPhoneAway(page);
    await expectNothingBroken(page, `in month ${String(month + 1)}`);
  }
});

test("[R-PROLOGUE-014] a life from sixteen fills its page with no card, waits on it, and opens the world on Go", async ({ page }) => {
  await page.goto(`/${LIVED}`);
  await startArchetype(page, "The developer", 30_000, true);

  // The years go by on the page with no card (prologue.md R-PROLOGUE-010, 014).
  const handover = page.locator("[data-gate='handover']");
  await expect(handover).toBeVisible();
  await expect(page.locator("[data-prologue-card]")).toHaveCount(0);
  await expect(handover.locator("[data-family='turned']")).toBeVisible();
  await expect(handover.locator("[data-years] [data-fact]").first()).toBeVisible();
  // The page prints the family it drew and takes no stamp: none lands before a visa (R-PROLOGUE-009, 014, amended).
  await expect(handover.locator("[data-page] [data-field='family']")).not.toContainText("· · ·");
  await expect(handover.locator("[data-page] [data-stamp]")).toHaveCount(0);
  await expectNothingBroken(page, "on the page");
  // The page waits for the player (R-PROLOGUE-014): still there seconds later, until Go.
  await page.waitForTimeout(4_000);
  await expect(handover).toBeVisible();
  await handover.getByRole("button", { name: "Go", exact: true }).click();
  await expect(page.locator("[data-band]")).toBeVisible({ timeout: 6_000 });
  await expect(handover).toHaveCount(0);
  await expectNothingBroken(page, "in the world");
});

/** Ada's recorded life up to the flight: the client loads it as a save through the local authority. */
function adaBeforeFlight(): string {
  const save = lifeSaves["ada-careful"];
  if (save === undefined) throw new Error("No recorded life ada-careful.");
  return JSON.stringify({ save: { ...save, commands: save.commands.slice(0, -1) }, clock: { anchor: 0 } });
}

/**
 * R-SHARE-001: the recorded life loads in the month after its decision day, so the granted card is still due and opens
 * over the world first; it is closed.
 */
async function closeGranted(page: Page): Promise<void> {
  const granted = page.getByRole("dialog", { name: text["share.granted.title"] ?? "share.granted.title" });
  await expect(granted).toBeVisible({ timeout: 30_000 });
  await expect(granted.locator("[data-share-card='granted']")).toBeVisible();
  await granted.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

/** The ride to a stop the map holds open (R-WORLD-015, R-WORLD-017), by the stop's button beside the painted map. */
async function rideTo(page: Page, id: string): Promise<void> {
  await page.locator('[data-thumb="map"]').click();
  await page.waitForFunction(() => (window as unknown as { __map?: { ready?: boolean } }).__map?.ready === true, null, { timeout: 60_000 });
  await page.evaluate((stop) => document.querySelector<HTMLButtonElement>(`[data-stop="${stop}"]`)?.click(), id);
  await page.locator(`[data-ride-sheet="${id}"] [data-ride-main]`).click();
  await page.waitForFunction((stop) => {
    const city = (window as unknown as { __city?: { ready?: boolean; place?: string } }).__city;
    return city?.place === stop && city.ready === true;
  }, id, { timeout: 90_000 });
}

/** The send-off card opens once the flight's moment is closed; it is closed in turn (R-CHAPTER-006). */
async function closeSendOff(page: Page): Promise<void> {
  const card = page.locator("[data-share-card='send-off']");
  await expect(card).toBeVisible();
  await expect(card.getByText("Japacity is a game.")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
  await expect(page.locator("[data-share-card]")).toHaveCount(0);
}

/** At the airport's departures, Board the plane (R-CHAPTER-006, route/depart): the landing takes the whole screen, then the send-off. */
async function boardThePlane(page: Page): Promise<void> {
  await closeGranted(page);
  await placeReady(page);
  await rideTo(page, "place.airport-lagos");
  await doAct(page, "gate", "depart");
  const board = page.locator("[data-ask-main]");
  await expect(board).toContainText("Board the plane");
  await board.click();
  const moment = page.locator("[data-moment-screen]");
  await expect(moment).toBeVisible({ timeout: 30_000 });
  const box = await moment.boundingBox();
  const size = page.viewportSize();
  expect(box !== null && size !== null && box.width >= size.width && box.height >= size.height).toBe(true);
  await expect(moment).toContainText(/landed/i);
  await expectNothingBroken(page, "on the landing");
  await moment.getByRole("button", { name: "Close" }).click();
  await closeSendOff(page);
  await passCards(page);
  await placeReady(page);
  await passHomeTeach(page);
}

/**
 * The months abroad to live before the December visit opens: it opens as a December month ends, and the world, not the
 * recorded seed, says which month that is.
 */
function monthsToDecember(): number {
  const save = lifeSaves["ada-careful"];
  if (save === undefined) throw new Error("No recorded life ada-careful.");
  const flight = save.commands[save.commands.length - 1]?.tick ?? 0;
  for (let tick = flight; tick < flight + 12; tick += 1) {
    if (standInWorld(save.worldSeed, tick, content).vars["var.season-december"] === 1) return tick - flight + 1;
  }
  throw new Error("No December in the year after the flight.");
}

/** Sleeps the month through, reads the results for broken text and goes back to the place. */
async function liveMonthAndRead(page: Page, when: string): Promise<void> {
  const results = await sleepTheMonth(page);
  await expect(results.getByRole("heading", { name: "The month is done" })).toBeVisible();
  await expectNothingBroken(page, when);
  await backFromResults(page);
}

test("a recorded life boards the plane, the landing gets the whole screen, and life abroad has its own money, room and visa", async ({ page }, info) => {
  test.skip(info.project.name !== "Pixel 7", "The world is lived at phone size");
  test.setTimeout(240_000);
  await seedSave(page, adaBeforeFlight());
  await page.goto(`/${LIVED}`);
  await boardThePlane(page);

  // Abroad: the band counts the country's money and names the room there; the Japa app holds the visa and the landing.
  await expect(page.locator("[data-band]")).toContainText("£");
  const abroad = await placeNow(page);
  expect(abroad).not.toBe("place.family-house");
  const japa = await openApp(page, "japa");
  await expect(japa.locator("[data-japa-visa]")).toBeVisible();
  await expect(japa.locator("[data-landing]")).toBeVisible();
  await expectNothingBroken(page, "on landing");
  await putPhoneAway(page);

  // The life abroad survives a reload; the card closed before it stays closed, since the month's memory keeps that (R-WORLD-008).
  await page.reload();
  await placeReady(page);
  await expect(page.locator("[data-share-card]")).toHaveCount(0);
  expect(await placeNow(page)).toBe(abroad);
  await expect(page.locator("[data-band]")).toContainText("£");

  // A month abroad and its results; the card had its month and does not come back, after a reload either.
  await liveMonthAndRead(page, "in the first results abroad");
  await passCards(page);
  await expect(page.locator("[data-share-card]")).toHaveCount(0);
  await page.reload();
  await placeReady(page);
  expect(await placeNow(page)).toBe(abroad);
  await expect(page.locator("[data-share-card]")).toHaveCount(0);
});

test("a life abroad answers the December visit and changes money", async ({ page }, info) => {
  test.skip(info.project.name !== "Pixel 7", "The world is lived at phone size");
  test.setTimeout(420_000);
  await seedSave(page, adaBeforeFlight());
  await page.goto(`/${LIVED}`);
  await boardThePlane(page);

  // December: the visit waits on its answers once the December month has ended; its line under the band opens it.
  const months = monthsToDecember();
  for (let month = 1; month <= months; month += 1) await liveMonthAndRead(page, `in results ${String(month)} abroad`);
  await passCards(page);
  const nudge = page.locator("[data-nudge-open]");
  await expect(nudge).toHaveText("Answer what you were asked");
  await nudge.click();
  // The line opens the asks, the December tile first, and the visit's scene over them; the tile's Answer now opens it when it has not.
  const asks = page.locator("[data-world-sheet='asks']");
  await expect(asks.locator("[data-december-tile]")).toBeAttached();
  const scene = page.locator("[data-scene='setpiece.december']");
  if (!(await scene.waitFor({ state: "visible", timeout: 3000 }).then(() => true, () => false))) await asks.locator("[data-december-tile] button").click();
  await expect(scene).toBeVisible();
  await expectNothingBroken(page, "in the December visit");
  const go = scene.locator("[data-answer='go']");
  await expect(go.getByRole("button")).toBeDisabled();
  await expect(go.getByText(/You cannot do that now/)).toBeVisible();
  await scene.locator("[data-answer='stay']").getByRole("button").click();
  // The rest of the visit's questions, each by its first answer allowed, until the scene is done.
  for (let question = 0; question < 6 && (await scene.count()) > 0; question += 1) {
    await scene.locator("[data-answer][data-allowed='true']").first().getByRole("button").click({ timeout: 5000 }).catch(() => undefined);
    await page.waitForTimeout(400);
  }
  await expect(scene).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("[data-december-tile]")).toHaveCount(0);

  // Dollars into naira at the bank (R-WALLET-005), the money held at home for the fare back.
  const bank = await openApp(page, "bank");
  const naira = async () => Number(((await bank.locator("[data-held='NGN']").textContent()) ?? "").replace(/[^\d]/g, ""));
  const dollars = async () => Number(((await bank.locator("[data-held='USD']").textContent()) ?? "").replace(/[^\d]/g, ""));
  const [nairaBefore, dollarsBefore] = [await naira(), await dollars()];
  await bank.locator("[data-held='USD']").getByRole("button").click();
  const chooser = bank.locator("[data-chooser='change']");
  await chooser.getByRole("radiogroup", { name: /into|to/i }).getByRole("radio", { name: "Naira" }).click();
  await chooser.locator("[data-go='change']").click();
  await page.locator("[data-ask-main]").click();
  await expect.poll(dollars).toBeLessThan(dollarsBefore);
  await expect.poll(naira).toBeGreaterThan(nairaBefore);
  await expectNothingBroken(page, "after changing money");
});

/** The japacity figure in the Japa app: its face and size as the browser draws it. */
async function japaFigure(page: Page): Promise<{ family: string; size: number }> {
  const japa = await openApp(page, "japa");
  // How ready you are is a bar, never a figure (R-WORLD-019 as the phone wave amended it); the way's name is the figure said large.
  const figure = japa.locator("[data-japa-plan]");
  await expect(figure).toBeVisible();
  return figure.evaluate((element) => {
    const style = getComputedStyle(element);
    return { family: style.fontFamily, size: Number.parseFloat(style.fontSize) };
  });
}

for (const [where, viewport] of [["a 390 px phone", { width: 390, height: 844 }], ["a desktop", { width: 1280, height: 800 }]] as const) {
  test.describe(`the japacity figure on ${where}`, () => {
    test.use({ viewport });

    test("the japacity figure is set in the body face, large enough to read, and the game's name is said once", async ({ page }) => {
      test.setTimeout(120_000);
      await seedSave(page, adaBeforeFlight());
      await page.goto(`/${LIVED}`);
      await closeGranted(page);
      const { family, size } = await japaFigure(page);
      expect(family).not.toMatch(/Danfo/);
      expect(family).toMatch(/Rubik/);
      expect(size).toBeGreaterThanOrEqual(24);
      // No page header names the game over the world (R-WORLD-001), and the app says Japacity once, over its figure.
      await expect(page.locator("header h1")).toHaveCount(0);
      const head = await page.locator("[data-app-screen='japa'] [data-japa-head]").textContent();
      expect(head?.match(/japacity/gi) ?? []).toHaveLength(1);
    });
  });
}

/** Tunde's life played by the simulation until the tutoring is offered: the job hunt asked for it each month, at most twelve. */
function tundeOfferedTutoring(): string {
  const game = start({ scenario: "scenario.tunde", content });
  const tutoring = "activity.weekend-tutoring" as Id<"activity">;
  const offered = () => game.view().offers.some((offer) => offer.terms.job === tutoring);
  for (let month = 0; month < 12 && !offered(); month += 1) {
    if (game.state.turn.banked === 0) game.grant(1);
    game.endTurn([{ activity: "activity.job-hunt", param: tutoring }] as Parameters<typeof game.endTurn>[0]);
  }
  if (!offered()) throw new Error("The tutoring was never offered.");
  if (game.state.turn.banked === 0) game.grant(1);
  return JSON.stringify({ save: game.save, clock: { anchor: 0 } });
}

test.describe("the side job on a 390 px phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("a side job taken in Jobs keeps its words whole across the row, with the quit button beside them inside the screen", async ({ page }) => {
    test.setTimeout(120_000);
    await seedSave(page, tundeOfferedTutoring());
    await page.goto(`/${LIVED}`);
    await passCards(page);
    await placeReady(page);
    await passHomeTeach(page, 2000);

    const jobs = await openApp(page, "jobs");
    const offer = jobs.locator("[data-offer]", { hasText: /tutoring/i }).first();
    await offer.getByRole("radio").click();
    await jobs.locator("[data-take-offer]").click();
    await page.locator("[data-ask-main]").click();
    const side = jobs.locator("[data-job-row]", { hasText: /tutoring/i });
    await expect(side).toBeVisible();
    await expectNothingBroken(page, "on the side job");

    const row = await side.boundingBox();
    const words = await side.locator("p").first().boundingBox();
    const quit = await side.getByRole("button", { name: "Quit" }).boundingBox();
    const screen = await jobs.boundingBox();
    expect(row !== null && words !== null && quit !== null && screen !== null).toBe(true);
    if (row === null || words === null || quit === null || screen === null) return;
    // The name is whole, never cut: it fits the room the row gives it.
    expect(await side.locator("p").first().evaluate((name) => name.scrollWidth <= name.clientWidth)).toBe(true);
    expect(quit.x).toBeGreaterThanOrEqual(words.x + words.width);
    expect(quit.x + quit.width).toBeLessThanOrEqual(screen.x + screen.width);
    // The card gives the picture tile its square and the button its width; the words take more room than the button.
    expect(words.width).toBeGreaterThan(quit.width);
  });
});
