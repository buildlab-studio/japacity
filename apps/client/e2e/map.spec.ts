// The map and the ride in a real browser at phone size (world:map-is-painted-lagos, world:one-country-at-a-time and world:ride-sheet-shows-fares): the
// painted map opens folded on the card where the player stands, the strip unfolds it into the whole
// map, a pin there folds it back on its card with the stop picked, the route runs from the player's
// stop to the stop, the ride sheet rises, and the ride plays and lands in the place. With MAP_SHOTS
// set to a folder, the pictures of each step are saved there.
import { devices, expect, type Page } from "@playwright/test";
import { test } from "./support/policy";

import { text } from "../../../packages/content/src/index";
import { SOFTWARE_WEBGL } from "./support/browser";
import { startReadyLife } from "./support/door";
import { type CityProbe, passCards } from "./support/live";

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, launchOptions: SOFTWARE_WEBGL });

interface MapProbe {
  ready: boolean;
  phase: string;
  card: string;
  route: [number, number][] | null;
  channel: string | null;
  stops: { id: string; state: string; card: string; at: [number, number] }[];
}

declare global {
  interface Window {
    __map?: MapProbe;
  }
}

const SHOTS = process.env.MAP_SHOTS ?? null;

async function shot(page: Page, name: string): Promise<void> {
  if (SHOTS !== null) await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

/** A new life, played past its prologue by the first open answer each time. */
async function startLife(page: Page): Promise<void> {
  await page.goto("/");
  await startReadyLife(page);
  for (let step = 0; step < 40; step += 1) {
    if ((await page.locator("[data-band]").count()) > 0) break;
    const handover = page.locator("[data-page-handover] button");
    if ((await handover.count()) > 0) {
      await handover.first().click();
      break;
    }
    const start = page.getByRole("button", { name: /^Go$/ });
    if ((await start.count()) > 0) {
      await start.first().click();
      await page.waitForTimeout(400);
      continue;
    }
    const answer = page.locator("[data-answer] button:not([disabled])").first();
    await answer.waitFor({ timeout: 8000 });
    await answer.click();
    await page.waitForTimeout(250);
  }
  await page.waitForSelector("[data-band]", { timeout: 30_000 });
  // The first brief's card stands on the drawn place until its Let's go (chapter:first-chapter-mission-card), so the
  // place is waited for and the card passed before any thumb is tapped.
  await page.waitForFunction(() => (window as unknown as { __city?: CityProbe }).__city?.ready === true, null, { timeout: 90_000 });
  await passCards(page);
}

test("[world:map-is-painted-lagos] [world:ride-sheet-shows-fares] given a life at home on a phone, when the map opens, unfolds and a pin is picked and ridden to, then it opens folded on the player's card, the pin folds it back on its own card with the route from the player's stop, and the ride lands there", async ({ page }, info) => {
  test.skip(info.project.name !== "Pixel 7", "The map is measured at phone size");
  test.setTimeout(180_000);
  await startLife(page);
  await page.waitForFunction(() => (window as unknown as { __city?: CityProbe }).__city?.ready === true, null, { timeout: 90_000 });
  const from = await page.evaluate(() => (window as unknown as { __city?: CityProbe }).__city?.place ?? "");

  await page.locator('[data-thumb="map"]').click();
  await page.waitForSelector("[data-map]");
  await page.waitForFunction(() => window.__map?.ready === true, null, { timeout: 30_000 });
  const opened = await page.evaluate(() => window.__map);
  const here = opened?.stops.find((stop) => stop.state === "here");
  expect(here?.id).toBe(from);
  expect(opened?.phase).toBe("folded");
  // Opened on the card where the player stands, unless a step points elsewhere; either way the card shows its own stickers.
  await expect(page.locator(`[data-card="${opened?.card ?? ""}"][data-current="true"]`)).toBeVisible();
  await expect(page.locator("[data-strip]")).toBeVisible();
  await shot(page, "01-card");

  // The strip unfolds the whole map.
  await page.locator("[data-strip]").click();
  await page.waitForFunction(() => window.__map?.phase === "open", null, { timeout: 20_000 });
  await expect(page.locator("[data-open-map]")).toBeVisible();
  await shot(page, "03-map-open");

  // A pin of the open map folds it back on its own card, with the stop picked and the route lit from the player's stop.
  const away = (opened?.stops ?? []).filter((stop) => stop.state !== "here" && stop.state !== "not" && stop.id !== "place.family-house");
  const target = (away.find((stop) => stop.id === "place.national-stadium") ?? away[0])?.id ?? "";
  await page.locator(`[data-open-map] [data-pin="${target}"]`).click();
  await expect(page.locator(`[data-ride-sheet="${target}"]`)).toBeVisible();
  await page.waitForFunction(() => window.__map?.phase === "folded", null, { timeout: 20_000 });
  const lit = await page.evaluate(() => window.__map);
  const there = lit?.stops.find((stop) => stop.id === target);
  expect(lit?.card).toBe(there?.card);
  expect(lit?.route?.[0]).toEqual(here?.at);
  expect(lit?.route?.[(lit.route.length || 1) - 1]).toEqual(there?.at);
  expect(lit?.channel).toBe(here?.card === there?.card ? "card" : "strip");
  await expect(page.locator(`[data-route-line]`).first()).toBeVisible();
  // The button says the ride and its fare, the balance before struck through under it with the balance after (decision 0011), never "left".
  await expect(page.locator("[data-ride-main]")).toContainText("₦");
  await expect(page.locator("[data-ride-main]")).not.toContainText("left");
  await expect(page.locator("[data-balance-before]")).toBeVisible();
  await expect(page.locator("[data-balance-after]")).toBeVisible();
  await shot(page, "05-stop-picked");

  // The ride: a short scene with its band and Skip, then the place opens with its name on the band. The corner does
  // not tell it: the corner holds only the player's own act's answer (world:street-talk-budget).
  await page.locator('[data-way="danfo"]').click();
  await page.locator("[data-ride-main]").click();
  await expect(page.locator("[data-ride]")).toBeVisible();
  await expect(page.locator("[data-ride-title]")).toContainText("Danfo to");
  await page.waitForTimeout(2600);
  await shot(page, "08-ride");
  await expect(page.locator("[data-ride]")).toBeHidden({ timeout: 8000 });
  await page.waitForFunction((id) => (window as unknown as { __city?: CityProbe }).__city?.place === id, target, { timeout: 30_000 });
  // The band names the place small (world:top-band-is-a-pill), by its short name where content gives one.
  await expect(page.locator("[data-band] h2")).toHaveText(text[`${target}.short`] ?? text[`${target}.name`] ?? target);
  await shot(page, "09-arrived");
});

test("[world:map-is-painted-lagos] given the map folded on a phone, when the strip is dragged down and a district of the open map is tapped, then the map opens and folds back on that district's card, and the cards swipe sideways", async ({ page }, info) => {
  test.skip(info.project.name !== "Pixel 7", "The fold is a phone's");
  test.setTimeout(150_000);
  await startLife(page);
  await page.locator('[data-thumb="map"]').click();
  await page.waitForFunction(() => window.__map?.ready === true, null, { timeout: 30_000 });
  const strip = await page.locator("[data-strip]").boundingBox();
  const x = (strip?.x ?? 0) + (strip?.width ?? 0) / 2;
  const y = (strip?.y ?? 0) + (strip?.height ?? 0) / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 60, { steps: 4 });
  await shot(page, "02-strip-pulling");
  await page.mouse.move(x, y + 260, { steps: 6 });
  await page.mouse.up();
  await page.waitForFunction(() => window.__map?.phase === "open", null, { timeout: 20_000 });
  await page.waitForTimeout(400);
  // The island's name on the open map: a tap on the paper just under it folds back on the island's card. Where it stands on
  // the screen is read from its paper point and the open map's own move and zoom.
  const point = await page.evaluate(() => {
    const label = document.querySelector<SVGTextElement>('[data-open-map] [data-district="map.area.lagos-island"]');
    const world = document.querySelector<HTMLElement>("[data-open-map] [data-world]");
    const moved = /translate\(([-\d.]+)px, ([-\d.]+)px\) scale\(([-\d.]+)/.exec(world?.style.transform ?? "");
    if (label === null || moved === null) return null;
    const [x, y, z] = [Number(moved[1]), Number(moved[2]), Number(moved[3])];
    return { x: x + Number(label.getAttribute("x")) * z, y: y + (Number(label.getAttribute("y")) + 10) * z };
  });
  expect(point).not.toBeNull();
  await page.mouse.click(point?.x ?? 0, point?.y ?? 0);
  await page.waitForFunction(() => window.__map?.phase === "folded", null, { timeout: 20_000 });
  expect(await page.evaluate(() => window.__map?.card)).toBe("island");
  await expect(page.locator('[data-card="island"][data-current="true"]')).toBeVisible();
  await shot(page, "04-folded-back-island");
  // A swipe to the next card along, once the track stands on the island's card.
  await page.waitForFunction(() => {
    const track = document.querySelector<HTMLElement>("[data-track]");
    return track !== null && Math.abs(track.scrollLeft - 7 * track.clientWidth) < 2;
  }, null, { timeout: 20_000 });
  await page.locator("[data-track]").evaluate((track) => track.scrollBy({ left: track.clientWidth, behavior: "auto" }));
  await page.waitForFunction(() => window.__map?.card === "lekki", null, { timeout: 20_000 });
});

test("[world:ride-cuts-between-angles] given a life at home on a phone, when a danfo ride plays, then it cuts by itself from outside at the stop to above, the window and the seat, each once and in order, with no view switch", async ({ page }, info) => {
  test.skip(info.project.name !== "Pixel 7", "The ride is watched at phone size");
  test.setTimeout(180_000);
  await startLife(page);
  await page.waitForFunction(() => (window as unknown as { __city?: CityProbe }).__city?.ready === true, null, { timeout: 90_000 });
  await page.locator('[data-thumb="map"]').click();
  await page.waitForSelector("[data-map]");
  await page.waitForFunction(() => window.__map?.ready === true, null, { timeout: 60_000 });
  const stops = (await page.evaluate(() => window.__map?.stops)) ?? [];
  const target = stops.find((stop) => stop.state !== "here" && stop.state !== "not" && stop.id !== "place.family-house")?.id ?? "";
  await page.locator(`[data-stop="${target}"]`).dispatchEvent("click");
  await expect(page.locator(`[data-ride-sheet="${target}"]`)).toBeVisible();
  await page.locator('[data-way="danfo"]').click();
  await page.locator("[data-ride-main]").click();
  await expect(page.locator("[data-ride]")).toBeVisible();
  // The card holds only Skip and, apart below it, Turn back (world:costly-acts-confirmed): the ride picks its own angles.
  await expect(page.locator("[data-ride] button")).toHaveText(["Skip", "Turn back"]);
  // The probe goes with the ride, so its angles are read until it ends.
  let angles: string[] = [];
  let began = false;
  const seenOnScreen = new Set<string>();
  for (let poll = 0; poll < 400; poll += 1) {
    const now = await page.evaluate(() => {
      const probe = (window as unknown as { __ride?: { angle: string; angles: string[] } }).__ride;
      const shown = document.querySelector<HTMLElement>("[data-ride]")?.dataset.rideAngle ?? null;
      return probe === undefined ? null : { angles: [...probe.angles], shown };
    });
    if (now === null && began) break;
    if (now === null) {
      await page.waitForTimeout(50);
      continue;
    }
    began = true;
    angles = now.angles;
    if (now.shown !== null) seenOnScreen.add(now.shown);
    await page.waitForTimeout(50);
  }
  console.log(`ride angles: ${angles.join(", ")}`);
  expect(angles).toEqual(["outside", "above", "window", "seat"]);
  expect([...seenOnScreen]).toEqual(["outside", "above", "window", "seat"]);
  await expect(page.locator("[data-ride]")).toBeHidden({ timeout: 8000 });
});

test("[world:one-country-at-a-time] given the map open on a phone, when a locked country in the dropdown is tapped, then it shakes and stays shut", async ({ page }, info) => {
  test.skip(info.project.name !== "Pixel 7", "The map is shown at phone size");
  test.setTimeout(120_000);
  await startLife(page);
  await page.locator('[data-thumb="map"]').click();
  await page.waitForSelector("[data-map]");
  await page.waitForFunction(() => window.__map?.ready === true, null, { timeout: 60_000 });
  await page.locator("[data-country-menu] > button").click();
  const locked = page.locator('[data-country-option][data-locked="true"]').first();
  await locked.click({ force: true });
  await expect(locked).toHaveAttribute("data-shake", "true");
  await expect(page.locator("[data-country-menu] > button")).toHaveAttribute("data-country", "lagos");
  await shot(page, "05-country-locked");
});

test.describe("on a Pixel 7", () => {
  const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices["Pixel 7"];
  test.use({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });

  test("[world:one-country-at-a-time] given the whole map open on a Pixel 7, when the country menu at its top is opened, then its list opens downward and every country is on the screen and can be tapped; folded, the menu at the foot opens upward, every country on the screen", async ({ page }, info) => {
    test.skip(info.project.name !== "Pixel 7", "The map is shown at phone size");
    test.setTimeout(120_000);
    await startLife(page);
    await page.locator('[data-thumb="map"]').click();
    await page.waitForSelector("[data-map]");
    await page.waitForFunction(() => window.__map?.ready === true, null, { timeout: 60_000 });
    const screen = page.viewportSize() ?? viewport;
    /** Every option of the open list stands whole inside the screen and takes a tap where it stands. */
    async function everyOptionOnScreen(): Promise<void> {
      const options = page.locator("[data-country-option]");
      const count = await options.count();
      expect(count).toBeGreaterThan(1);
      for (let index = 0; index < count; index += 1) {
        const option = options.nth(index);
        await expect(option).toBeInViewport({ ratio: 1 });
        const box = await option.boundingBox();
        expect(box).not.toBeNull();
        if (box === null) continue;
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.y + box.height).toBeLessThanOrEqual(screen.height);
        // Nothing stands over it: a finger at its middle lands on the option itself (a locked one takes the tap and shakes).
        const hit = await option.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          const under = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
          return under !== null && element.contains(under);
        });
        expect(hit).toBe(true);
      }
    }
    // Folded: the menu at the foot, its list upward.
    await page.locator("[data-country-menu] > button").click();
    await everyOptionOnScreen();
    await page.locator("[data-country-menu] > button").click();
    // Open: the menu at the top, its list downward.
    await page.locator("[data-strip]").click();
    await page.waitForFunction(() => window.__map?.phase === "open", null, { timeout: 30_000 });
    await expect(page.locator("[data-country-menu]")).toHaveCount(1);
    await page.locator("[data-country-menu] > button").click();
    const list = page.getByRole("listbox");
    await expect(list).toBeVisible();
    // Once its short drop has played, the list stands under the pill.
    const pill = await page.locator("[data-country-menu] > button").boundingBox();
    await expect.poll(async () => ((await list.boundingBox())?.y ?? 0) >= (pill === null ? Number.POSITIVE_INFINITY : pill.y + pill.height)).toBe(true);
    await everyOptionOnScreen();
    await shot(page, "06-country-menu-open-map");
  });
});
