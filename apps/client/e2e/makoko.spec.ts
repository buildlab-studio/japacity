// Makoko's five scenes on a phone (city:makoko-holds-five-scenes, world:entering-is-a-cut, home:home-is-the-home-point, world:top-band-is-a-pill):
// the child of the water opens on the channel, each door on the walk cuts into its own scene and back, and the band names each; the
// racks' nudge from the walk stands on the smoking deck's door and the racks' act opens on the deck; the rented house's door opens
// only for a life that lives on the water. With PREVIEW_DIR set it saves each scene by morning and by night and the frames of the
// cut into the room and out, taken off the cut itself.
import { expect, type Page } from "@playwright/test";
import { test } from "./support/policy";

import { SOFTWARE_WEBGL } from "./support/browser";
import { passOpeningWords, startArchetype, startReadyLife } from "./support/door";
import { doAct, passCards, passHomeTeach, placeReady, rideTo } from "./support/live";
import { previewDir, shoot } from "./support/preview";

test.use({ viewport: { width: 390, height: 844 }, launchOptions: SOFTWARE_WEBGL });
test.setTimeout(420_000);

/** The doors on the channel, the scene each cuts into, and the band's words there. */
const DOORS = [
  { door: "room", band: "Your room, Makoko", picture: "room" },
  { door: "smoking-deck", band: "Smoking deck", picture: "smoking-deck" },
  { door: "net-shed", band: "Net shed", picture: "net-shed" },
  { door: "viewing-centre", band: "Viewing centre", picture: "viewing-centre" },
] as const;

async function settle(page: Page): Promise<void> {
  await placeReady(page);
  await passOpeningWords(page);
  await passCards(page);
  await passHomeTeach(page);
  await passCards(page);
}

/** The band's words as the player reads them. */
async function band(page: Page): Promise<string> {
  return (await page.locator("[data-band]").first().textContent()) ?? "";
}

/**
 * The cut as it runs (world:entering-is-a-cut), hooked on the cut itself: the frame as the screen starts to go dark, the frame at its
 * darkest, and the frame once the new scene stands and the dark has lifted.
 */
async function cutFrames(page: Page, name: string | null): Promise<void> {
  await page.locator('[data-cut="true"]').waitFor({ state: "attached", timeout: 30_000 });
  if (name !== null) await shoot(page, `${name}-1`);
  if (name !== null) await shoot(page, `${name}-2`);
  await page.locator('[data-cut="false"]').waitFor({ state: "attached", timeout: 30_000 });
  await placeReady(page);
  if (name !== null) await shoot(page, `${name}-3`, { settleMs: 400 });
}

/** Back out to the channel by the scene's way out. */
async function stepOut(page: Page, name: string | null): Promise<void> {
  await doAct(page, "out", "out");
  await cutFrames(page, name);
  await page.locator('[data-mark="room"], [data-marker="room"]').first().waitFor({ state: "attached", timeout: 30_000 });
}

test("[city:makoko-holds-five-scenes] [world:entering-is-a-cut] [world:top-band-is-a-pill] given the child of the water on the channel, when each door on the walk is gone through and out again, then each opens its own scene with the cut and the band names it, by morning and by night", async ({ page }) => {
  await page.goto("/?clock=morning");
  await startArchetype(page, "The child of the water");
  await settle(page);
  for (const clock of ["morning", "night"] as const) {
    if (clock === "night") {
      await page.goto("/?clock=night");
      await settle(page);
    }
    expect(await band(page)).toContain("Makoko");
    await shoot(page, `channel-${clock}`, { settleMs: 1500 });
    for (const { door, band: words, picture } of DOORS) {
      await doAct(page, door, "enter");
      const frames = clock === "morning" && door === "room";
      await cutFrames(page, frames ? "cut-in" : null);
      await passCards(page);
      expect(await band(page)).toContain(words);
      // Taken in the moment the scene stands and before its talk starts, so no bubble covers it.
      await shoot(page, `${picture}-${clock}`, { settleMs: 700 });
      await stepOut(page, frames ? "cut-out" : null);
      expect(await band(page)).toContain("Makoko");
    }
  }
});

test("[world:entering-is-a-cut] [activity:fish-racks-at-makoko] given the child of the water with no job, when the nudge is read on the walk, then its marker stands on the smoking deck's door, and on the deck the racks' act opens the job's card", async ({ page }) => {
  await page.goto("/?clock=morning");
  await startArchetype(page, "The child of the water");
  await settle(page);
  await expect(page.locator('[data-marker="smoking-deck"]')).toBeAttached({ timeout: 30_000 });
  await expect(page.locator('[data-marker="racks"]')).toHaveCount(0);
  await doAct(page, "smoking-deck", "enter");
  await cutFrames(page, null);
  await passCards(page);
  await expect(page.locator('[data-marker="racks"]')).toBeAttached({ timeout: 30_000 });
  await doAct(page, "racks", "work");
  const card = page.getByRole("dialog").filter({ hasText: /racks/i }).first();
  await expect(card).toBeVisible({ timeout: 30_000 });
  // The card says where it is, by the deck's own name (world:top-band-is-a-pill).
  await expect(card).toContainText("Smoking deck");
  await shoot(page, "racks-act-on-the-deck", { settleMs: 800 });
});

test("[home:home-is-the-home-point] given a life that lives at the family house, when it rides to Makoko, then the rented house is a neighbour's with nothing to tap, and the deck, the shed and the viewing centre open as for anyone", async ({ page }) => {
  test.skip(previewDir !== null, "Pictures are taken by the other tests.");
  await page.goto("/?clock=morning");
  await startReadyLife(page);
  await placeReady(page);
  await passOpeningWords(page);
  await passCards(page);
  await rideTo(page, "place.makoko");
  await passCards(page);
  for (const door of ["smoking-deck", "net-shed", "viewing-centre"]) await expect(page.locator(`[data-mark="${door}"], [data-marker="${door}"]`).first()).toBeAttached({ timeout: 30_000 });
  await expect(page.locator('[data-mark="room"]')).toHaveCount(0);
  expect(await band(page)).toContain("Makoko");
});
