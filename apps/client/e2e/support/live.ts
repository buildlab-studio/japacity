// The month lived by hand in a browser test (world:sleep-ends-the-month, world:month-passes-as-lived; decision 0011): the bed's
// Sleep turns the month, the results open over the scene, and Back returns to the place. The address's `?sleep=<seconds>`
// shortens the sleep and `?morning=now` opens every sealed result at once (clock:envelopes-show-real-waits), both read by a development build
// only, which the suite's server is. The phone's apps are opened from the Phone thumb.
import { expect, type Page } from "@playwright/test";

import { cardsSettled } from "./door";

import { text } from "../../../../packages/content/src/index";

/** The address a test opens: the sleep cut to two seconds and the morning's results opened at once. */
export const LIVED = "?sleep=2&morning=now";

/** The probe the scene sets on the window; only its place and readiness are read here. */
export type CityProbe = { ready?: boolean; place?: string } | undefined;

/** Waits for the place to be drawn, so its things can be tapped. */
export async function placeReady(page: Page, timeout = 90_000): Promise<void> {
  await page.waitForFunction(() => (window as unknown as { __city?: CityProbe }).__city?.ready === true, null, { timeout });
}

/** The place the scene stands in. */
export async function placeNow(page: Page): Promise<string> {
  return page.evaluate(() => (window as unknown as { __city?: CityProbe }).__city?.place ?? "");
}

/** The home's teach card, shown once on the first entry into the home in a life (home:moves-carry-cost-and-reason), dismissed so the place is clear. */
export async function passHomeTeach(page: Page, timeout = 4000): Promise<void> {
  const teach = page.locator("[data-home-teach-ok]");
  if (await teach.waitFor({ state: "visible", timeout }).then(() => true, () => false)) await teach.click();
}

/**
 * Until the middle of the button a tap would land on is the button's own, as a player sees it bare before tapping. An emote over
 * a resident standing in front of a thing covers its mark, and a tap there is a tap on that person; a word bubble may stand
 * over a thing's dot, which can be tapped a moment later (world:street-talk-budget). The emotes move on to other residents
 * every few seconds while nothing is tapped, and the bubble goes. A forced click skips Playwright's own check of this, so it
 * is made here. Says whether the button came clear; where it stays covered the caller decides, and its look for what
 * the tap opened says so.
 */
async function clearToTap(page: Page, selector: string): Promise<boolean> {
  return page
    .waitForFunction(
      (target) => {
        const button = document.querySelector<HTMLElement>(target);
        if (button === null) return true;
        const box = button.getBoundingClientRect();
        // A button gone from view is no longer the tap's: the caller looks again.
        if (box.width === 0 && box.height === 0) return true;
        const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
        return hit !== null && button.contains(hit);
      },
      selector,
      { timeout: 15_000 },
    )
    .then(() => true, () => false);
}

/**
 * A tap on a thing: on its quiet mark, or, where the step's marker stands on it in the mark's place (world:nudge-says-one-thing),
 * on the thing itself where the scene draws it.
 */
async function tapThing(page: Page, thing: string): Promise<void> {
  const mark = page.locator(`[data-mark="${thing}"]`);
  // A wide home eased in on one room hides the things of the others, or leaves their marks under the band (decision 0018):
  // the whole house first, as a player would, then the thing, which eases in on its own room.
  const whole = page.getByRole("button", { name: "See the whole place" });
  const wholeFirst = async () => {
    await whole.click();
    await page.waitForTimeout(600);
    await mark.waitFor({ state: "visible", timeout: 3000 }).catch(() => undefined);
  };
  if (await whole.isVisible().catch(() => false)) await wholeFirst();
  if (await mark.isVisible().catch(() => false)) {
    // A mark the nudge pulses never holds still for the stability check; the tap lands on the button all the same, once
    // nothing stands over it. While it waited the step's marker may have taken the mark's place, and is looked for next.
    // A room eased in on just as the phone was put away can leave the mark under the band for good, before the whole
    // house's button shows: then the whole house, once it shows, and the mark again, so the tap never opens the band's page.
    if (!(await clearToTap(page, `[data-mark="${thing}"]`)) && (await whole.isVisible().catch(() => false))) {
      await wholeFirst();
      await clearToTap(page, `[data-mark="${thing}"]`);
    }
    if (await mark.isVisible().catch(() => false)) {
      await mark.click({ timeout: 10_000, force: true });
      return;
    }
  }
  // The step's marker over the thing takes the tap (world:nudge-says-one-thing), so nobody standing in front of it does.
  const markerTap = page.locator(`[data-marker-tap="${thing}"]`);
  if (await markerTap.isVisible().catch(() => false)) {
    await clearToTap(page, `[data-marker-tap="${thing}"]`);
    if (await markerTap.isVisible().catch(() => false)) {
      await markerTap.click({ force: true });
      return;
    }
  }
  const at = await page.evaluate((id) => (window as unknown as { __city?: { screenOfThing?: (one: string) => { x: number; y: number } | null } }).__city?.screenOfThing?.(id) ?? null, thing);
  if (at === null) return;
  // The thing's model is picked where it is drawn, which its middle point may miss by a little: a few taps round it,
  // until one sets the character walking or opens something.
  const answered = () => page.evaluate(() => {
    const walker = (window as unknown as { __city?: { walker?: { target: unknown } } }).__city?.walker;
    return (walker?.target ?? null) !== null || document.querySelector("[role='dialog'], [data-fan], [data-fan-sheet]") !== null;
  });
  for (const [dx, dy] of [[0, 0], [0, -14], [12, -6], [-12, -6], [0, 10], [20, 0], [-20, 0], [0, -28]] as const) {
    await page.mouse.click(at.x + dx, at.y + dy);
    await page.waitForTimeout(400);
    if (await answered()) return;
  }
}

/**
 * A thing's act from the fan that opens out of it once it is tapped (world:fan-of-sticker-buttons), by the act's id or the entry its button
 * stages; where the free side of the screen cannot hold the fan, from the small sheet of the same buttons. The step's own
 * thing under its marker takes the step's act in one tap: the character walks there and the
 * act's card opens, with no fan; that card is then the act's.
 */
export async function doAct(page: Page, thing: string, act: string): Promise<void> {
  const fan = page.locator(`[data-fan="${thing}"], [data-fan-sheet="${thing}"]`);
  const button = fan.locator(`[data-fan-act="${act}"] button, [data-fan-from="${act}"] button`).first();
  // A place's things stand once the view says what is open here, a moment after the place is drawn.
  await page.locator(`[data-mark="${thing}"], [data-fan="${thing}"]`).first().waitFor({ state: "attached", timeout: 20_000 });
  const marked = !(await page.locator(`[data-mark="${thing}"]`).isVisible().catch(() => false)) && (await page.locator(`[data-marker="${thing}"]`).count()) > 0;
  for (let tries = 0; tries < 4 && !(await button.isVisible()); tries += 1) {
    await tapThing(page, thing);
    if (marked) {
      const card = page.getByRole("dialog");
      if (await card.or(button).first().waitFor({ state: "visible", timeout: 30_000 }).then(() => true, () => false)) {
        // The fan's own small sheet is a dialog too: only another card is the act's.
        if (!(await button.isVisible()) && (await card.first().isVisible())) return;
      }
    } else await button.waitFor({ state: "visible", timeout: 3000 }).catch(() => undefined);
  }
  await button.click({ timeout: 10_000 });
}

/** One of the simulation's acts done at once, from the fan that opens out of its thing (world:fan-of-sticker-buttons), by the activity it sends. */
export async function fanAct(page: Page, thing: string, activity: string): Promise<void> {
  const fan = page.locator(`[data-fan="${thing}"]`);
  // The fan's box is the point it opens from, with no size of its own: its buttons are what show.
  const button = fan.locator(`[data-fan-act="${activity}"] button`);
  for (let tries = 0; tries < 3 && !(await button.isVisible()); tries += 1) {
    await tapThing(page, thing);
    await button.waitFor({ state: "visible", timeout: 3000 }).catch(() => undefined);
  }
  await button.click({ timeout: 10_000 });
}

/** The bed's mark in whichever home the life is in: the family's mattress, the room's bed, the hostel's bunk (decision 0018). */
const BED_MARKS = '[data-mark="mattress"], [data-mark="bed"], [data-mark="bunk"]';

/** The bed's thing id in this home, read from its mark; the family's mattress when none is drawn yet. */
export async function bedThing(page: Page): Promise<string> {
  const mark = page.locator(BED_MARKS).first();
  if ((await mark.count()) === 0) return "mattress";
  return (await mark.getAttribute("data-mark")) ?? "mattress";
}

/**
 * To the home's bed: a wide home is seen whole, so the bed stands in view (decision 0018); a place with a yard and a
 * house door (world:entering-is-a-cut) is entered first. Nothing when the bed already shows.
 */
export async function intoTheRoom(page: Page): Promise<void> {
  if ((await page.locator(BED_MARKS).count()) > 0) return;
  if ((await page.locator('[data-mark="house"], [data-fan="house"]').count()) > 0) await doAct(page, "house", "enter");
  await page.locator(BED_MARKS).first().waitFor({ state: "attached", timeout: 60_000 });
  await placeReady(page);
}

/**
 * The cards that stand over the world or over the results, each passed by its own button: a moment card (moment:card-shows-when-outcome-lands: a
 * landing, a chapter done, a staged win) by its Close, a brief handed or a chapter closed by its Let's go (docs/design/09-the-games-look.md
 * section 4). True when one was passed.
 */
export async function passMomentCard(page: Page, seen?: () => Promise<void>): Promise<boolean> {
  const card = page.locator("[data-moment-screen]").first();
  if (await card.isVisible().catch(() => false)) {
    await seen?.();
    await card.getByRole("button", { name: "Close" }).click();
    await card.waitFor({ state: "detached", timeout: 5000 }).catch(() => undefined);
    return true;
  }
  const brief = page.locator("[data-brief-close-go], [data-brief-go]").first();
  if (await brief.isVisible().catch(() => false)) {
    await seen?.();
    await brief.click();
    await brief.waitFor({ state: "detached", timeout: 5000 }).catch(() => undefined);
    return true;
  }
  return false;
}

/** Every card standing over the world passed, until none is left. */
export async function passCards(page: Page, seen?: () => Promise<void>): Promise<void> {
  // The first brief's card may still be coming (chapter:first-chapter-mission-card): wait for it before looking.
  await cardsSettled(page);
  for (let passed = 0; passed < 6 && (await passMomentCard(page, seen)); passed += 1) await page.waitForTimeout(300);
}

/** The staged moments that come before the results (world:month-end-results-sheet), each passed in turn, until the results stand. */
export async function passMoments(page: Page, timeout = 30_000, seen?: () => Promise<void>): Promise<void> {
  const results = page.locator("[data-world-sheet='results']");
  const ends = Date.now() + timeout;
  while (Date.now() < ends && !(await results.isVisible())) {
    if (!(await passMomentCard(page, seen))) await page.waitForTimeout(250);
  }
}

/**
 * The bed's Sleep (world:sleep-ends-the-month): the first night's card says what sleep does once and is passed with its own Sleep; the
 * chip and Wake up stand while the sleep runs; when it runs out the month turns, and once the staged moments are passed
 * the results stand over the scene. `seen` looks at each card before it is passed. Returns the results sheet.
 */
export async function sleepTheMonth(page: Page, seen?: () => Promise<void>) {
  await passCards(page);
  await intoTheRoom(page);
  await doAct(page, await bedThing(page), "end-month");
  const firstNight = page.locator("[data-night-teach-ok]");
  if (await firstNight.waitFor({ state: "visible", timeout: 1500 }).then(() => true, () => false)) await firstNight.click();
  await passMoments(page, 30_000, seen);
  const results = page.locator("[data-world-sheet='results']");
  await expect(results).toBeVisible();
  // A moment card may come over the results a beat after them (moment:card-shows-when-outcome-lands); passed, the results are read.
  await page.waitForTimeout(800);
  await passCards(page, seen);
  return results;
}

/** Back from the results to the place (world:month-end-results-sheet), past any moment card that came over them, and the band again. */
export async function backFromResults(page: Page): Promise<void> {
  const back = page.locator("[data-results-back]");
  for (let tries = 0; tries < 6 && (await back.count()) > 0; tries += 1) {
    await page.waitForTimeout(400);
    if (await passMomentCard(page)) continue;
    await back.click({ timeout: 3000 }).catch(() => undefined);
  }
  await expect(page.locator("[data-world-sheet='results']")).toHaveCount(0);
  await expect(page.locator("[data-band]")).toHaveAttribute("aria-hidden", "false");
}

/** The phone from its thumb, on an app (world:phone-rises-over-scene); the app's screen is returned. */
export async function openApp(page: Page, app: string) {
  if ((await page.locator("[data-phone]").count()) === 0) await page.locator('[data-thumb="phone"]').click();
  const back = page.locator("[data-phone-back]");
  if (await back.isVisible().catch(() => false)) await back.click();
  await page.locator(`[data-app="${app}"]`).click();
  const screen = page.locator(`[data-app-screen="${app}"]`);
  await expect(screen).toBeVisible();
  return screen;
}

/** The phone put away by its home bar. */
export async function putPhoneAway(page: Page): Promise<void> {
  await page.locator("[data-home-bar]").click();
  await expect(page.locator("[data-phone]")).toHaveCount(0);
}

/** A save handed to the client once per tab, so a reload keeps what was played since (the local authority replays it). */
export async function seedSave(page: Page, stored: string): Promise<void> {
  await page.addInitScript((save) => {
    if (sessionStorage.getItem("seeded") === null) {
      localStorage.setItem("japacity.save", save);
      sessionStorage.setItem("seeded", "1");
    }
  }, stored);
  // The device marked as played (world:no-walkthrough-before-play), so no first-use label stands at the thumbs.
  await page.addInitScript(() => localStorage.setItem("japacity.walkthrough", "1"));
}

/**
 * share:cards-due-at-set-moments: a recorded life loaded in the month after its decision day still owes the granted card, which opens over
 * the world first; it is closed.
 */
export async function closeGranted(page: Page): Promise<void> {
  const granted = page.getByRole("dialog", { name: text["share.granted.title"] ?? "share.granted.title" });
  await expect(granted).toBeVisible({ timeout: 30_000 });
  await expect(granted.locator("[data-share-card='granted']")).toBeVisible();
  await granted.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

/** The ride to a stop the map holds open (world:map-is-painted-lagos, world:ride-sheet-shows-fares), by the stop's button beside the painted map. */
export async function rideTo(page: Page, id: string): Promise<void> {
  await page.locator('[data-thumb="map"]').click();
  await page.waitForFunction(() => (window as unknown as { __map?: { ready?: boolean } }).__map?.ready === true, null, { timeout: 60_000 });
  await page.evaluate((stop) => document.querySelector<HTMLButtonElement>(`[data-stop="${stop}"]`)?.click(), id);
  await page.locator(`[data-ride-sheet="${id}"] [data-ride-main]`).click();
  await page.waitForFunction((stop) => {
    const city = (window as unknown as { __city?: { ready?: boolean; place?: string } }).__city;
    return city?.place === stop && city.ready === true;
  }, id, { timeout: 90_000 });
}

/**
 * The send-off as a scene (chapter:send-off-scene-in-beats), once the gate's act has opened it: three taps of Step forward, the
 * stub taken, Board the plane, the plane's cut, the landing's staple, then Ring the bell into the room abroad.
 */
export async function boardThroughTheScene(page: Page): Promise<void> {
  const scene = page.locator("[data-send-off]");
  await expect(scene).toHaveAttribute("data-send-off", "departures", { timeout: 20_000 });
  for (let tap = 0; tap < 3; tap += 1) await scene.locator("[data-so-go='step']").click();
  await scene.locator("[data-so-go='take']").click({ timeout: 10_000 });
  await scene.locator("[data-so-go='board']").click();
  await scene.locator("[data-so-go='ride']").click({ timeout: 30_000 });
  await scene.locator("[data-so-go='ring']").click();
  await expect(scene).toHaveCount(0);
}
