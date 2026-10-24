// The world as the game, in a real browser at phone size (world:world-fills-the-screen, world:top-band-is-a-pill, world:nudge-says-one-thing, world:thumb-buttons-carry-dots, world:things-are-tappable-models, world:one-action-one-sheet, world:month-acts-carry-on, world:month-end-results-sheet, world:no-classic-view-kept, world:sleep-ends-the-month, world:month-passes-as-lived): the
// default address opens the world with the band and the two thumb buttons and nothing else, nothing under the band; ?classic
// opens the world as any address does; the band carries no Next month, its month opens the phone's Calendar; the month is lived and
// the bed's Sleep turns it, the results show over the scene and go back to the place; an ask waiting keeps its line under
// the band and a tap on it opens what is asked. With PREVIEW_DIR set, each step leaves a picture there.

import { expect, test, type Page } from "@playwright/test";

import { SOFTWARE_WEBGL } from "./support/browser";
import { passOpeningWords, startReadyLife } from "./support/door";
import { backFromResults, LIVED, passCards, passHomeTeach, placeNow, placeReady, putPhoneAway, seedSave, sleepTheMonth } from "./support/live";
import { shoot } from "./support/preview";
import { kept, recorded } from "./support/saves";

test.use({ viewport: { width: 390, height: 844 }, launchOptions: SOFTWARE_WEBGL });

/** The phone-size checks run once, on the phone project. */
function phoneOnly(project: string): void {
  test.skip(project !== "Pixel 7", "The world is checked at phone size.");
}

async function startLife(page: Page): Promise<void> {
  await page.goto(`/${LIVED}`);
  await startReadyLife(page);
  await expect(page.locator("[data-band]")).toBeVisible();
  await placeReady(page);
  await passCards(page);
}

/**
 * The names of the buttons a player can see over the place. The marks and labels over things and the talk over the crowd
 * belong to the scene (world:things-are-tappable-models, the talk budget of docs/design/09-the-games-look.md section 5), and the nudge is checked on its own.
 */
async function visibleButtons(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .filter((button) => button.closest("[data-marks], [data-mark], [data-speech], [data-nudge]") === null)
      .filter((button) => {
        const box = button.getBoundingClientRect();
        const hidden = button.closest("[aria-hidden='true']") !== null || getComputedStyle(button).visibility === "hidden";
        return box.width > 0 && box.height > 0 && !hidden;
      })
      .map((button) => (button.getAttribute("aria-label") ?? button.textContent).trim()),
  );
}

/** The graduate's recorded life one month in: the acts sent at once before its first month's end, not the end itself, whose turn opens the life's first offer. */
function graduateOneMonthIn(): string {
  const save = recorded("graduate-careful");
  const firstEnd = save.commands.findIndex((entry) => entry.command.type === "turn/end");
  return kept({ ...save, commands: save.commands.slice(0, firstEnd) });
}

test("[world:world-fills-the-screen] [world:no-classic-view-kept] [world:nudge-says-one-thing] the default address opens the world with the band, the two buttons and the wide home's round turn button and nothing else, and nothing under the band", async ({ page }, info) => {
  phoneOnly(info.project.name);
  test.setTimeout(120_000);
  await startLife(page);
  await expect(page.locator("[data-thumb='map']")).toBeVisible();
  await expect(page.locator("[data-thumb='phone']")).toBeVisible();
  // The home says what it is once, on its first entry in a life (home:moves-carry-cost-and-reason); dismissed, nothing else stands over the place.
  await passHomeTeach(page);
  // The journey's step shows only in the moment (world:nudge-says-one-thing): nothing under the band by default.
  await expect(page.locator("[data-nudge]")).toHaveCount(0);
  // The band: the name over the age opens the data page (prologue:front-door-builds-a-person; the name itself is that same button for a screen
  // reader), and the month's part of the day opens the Calendar (world:top-band-is-a-pill); then the two thumbs, and over Phone the
  // round button that turns the wide home a quarter round. No Next month: the bed turns the month
  // (world:month-passes-as-lived).
  const buttons = await visibleButtons(page);
  const month = buttons.find((name) => /^[A-Z][a-z]+, (Morning|Afternoon|Evening|Night)\. Open the calendar$/.test(name));
  expect(month).toBeDefined();
  expect(["place.family-house", "place.compound-room", "place.hostel-room"]).toContain(await placeNow(page));
  expect(buttons.sort()).toEqual(["Map", "Phone", "See another side", "Your page", month ?? ""].sort());
  await expect(page.locator("[data-end-month]")).toHaveCount(0);
  await expect(page.locator("header")).toHaveCount(0);
  await expect(page.locator("[data-tab]")).toHaveCount(0);
  await shoot(page, "world-open-phone");
});

test("[world:no-classic-view-kept] ?classic opens the world as any address does, with no month page", async ({ page }, info) => {
  phoneOnly(info.project.name);
  await page.goto("/?classic");
  await startReadyLife(page);
  await expect(page.locator("[data-band]")).toBeVisible();
  await expect(page.locator("header h1")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Month 1", exact: true })).toHaveCount(0);
});

test("[world:top-band-is-a-pill] [world:month-acts-carry-on] [world:month-end-results-sheet] [world:sleep-ends-the-month] [world:month-passes-as-lived] the band's month opens the Calendar with nothing to end; the bed's Sleep turns the month, the results show over the scene, and the button goes back to the place a month older", async ({ page }, info) => {
  phoneOnly(info.project.name);
  test.setTimeout(150_000);
  await startLife(page);
  await passHomeTeach(page);
  const place = (await page.locator("[data-band] h2").textContent()) ?? "";
  const where = await placeNow(page);
  const monthBefore = (await page.locator("[data-band-month]").getAttribute("aria-label")) ?? "";
  const bandBefore = (await page.locator("[data-band]").textContent()) ?? "";

  // The Calendar: what carries on (world:month-acts-carry-on), no Same again, no slot words, and nothing in it ends the month.
  await page.locator("[data-band-month]").click();
  const calendar = page.locator("[data-app-screen='calendar']");
  await expect(calendar).toBeVisible();
  await expect(calendar.locator("[data-calendar]").first()).toBeVisible();
  await expect(calendar.getByRole("button", { name: "Same again" })).toHaveCount(0);
  await expect(calendar.getByRole("button", { name: /Next month|End month/ })).toHaveCount(0);
  await expect(calendar).not.toContainText(/slot|takes no/i);
  await expect(page.locator("[data-nudge]")).toHaveCount(0);
  await page.waitForTimeout(900);
  await shoot(page, "world-month-phone");
  await putPhoneAway(page);

  // The bed's Sleep: the chip and Wake up while it runs, the month turns when it runs out (world:sleep-ends-the-month).
  const results = await sleepTheMonth(page);
  await expect(page.locator("[data-phone]")).toHaveCount(0);
  await expect(results.getByRole("heading", { name: "The month is done" })).toBeVisible();
  await expect(results.locator("[data-results-kept]")).toBeVisible();
  // The band and the thumb buttons step back while the results show.
  await expect(page.locator("[data-band]")).toHaveAttribute("aria-hidden", "true");
  await expect(page.locator("[data-thumb-bar]")).toHaveAttribute("aria-hidden", "true");
  await page.waitForTimeout(600);
  await shoot(page, "world-results-phone");

  await expect(results.locator("[data-results-back]")).toHaveText(new RegExp(`^Back to ${place.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"));
  await backFromResults(page);
  // The band's clock is the age, never a month number (world:top-band-is-a-pill): a month on, it reads one month older, in the next month.
  await expect(page.locator("[data-band]")).not.toHaveText(bandBefore);
  await expect(page.locator("[data-band]")).toContainText(/\d+ yrs \d+ mo/);
  await expect(page.locator("[data-band-month]")).not.toHaveAttribute("aria-label", monthBefore);
  await expect(page.locator("[data-band] h2")).toHaveText(place);
  expect(await placeNow(page)).toBe(where);
});

test("[world:nudge-says-one-thing] an ask waiting keeps its line under the band, and a tap on it opens what is asked", async ({ page }, info) => {
  phoneOnly(info.project.name);
  test.setTimeout(150_000);
  await seedSave(page, graduateOneMonthIn());
  await page.goto(`/${LIVED}`);
  // A seeded session has no report yet, so the first chapter's title stands over the world for a moment (chapter:first-chapter-mission-card).
  await passOpeningWords(page);
  await placeReady(page);
  await passHomeTeach(page);
  const nudge = page.locator("[data-nudge]");
  const line = async () => ((await nudge.count()) > 0 ? await nudge.textContent() : null);
  expect(await line()).not.toBe("Answer the person asking");

  // The recorded life's first offer opens within its first months; which month depends on the recording, so the test
  // sleeps months until the line turns to the ask, at most four.
  for (let month = 0; month < 4 && (await line()) !== "Answer the person asking"; month += 1) {
    await sleepTheMonth(page);
    await backFromResults(page);
  }
  await expect(nudge).toHaveText("Answer the person asking");
  await shoot(page, "world-nudge-offer-phone");

  await nudge.getByRole("button").click();
  const asks = page.locator("[data-world-sheet='asks']");
  await expect(asks).toBeVisible();
  await expect(asks.getByRole("listitem").first()).toBeVisible();
  await page.waitForTimeout(900);
  await shoot(page, "world-asks-phone");
});
