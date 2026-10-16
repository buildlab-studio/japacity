// London on the Lagos mold in a real browser at phone size (docs/rules/world.md R-WORLD-038, R-WORLD-039; place.md
// R-PLACE-010, R-PLACE-012; streets.md R-STREET-012): Ada's recorded life lands in London, she walks to Peckham Rye,
// buys the month's bus pass at the ticket machine, rides the bus free to the big shop, does the weekly shop, takes the
// train to the office at London Bridge for its fare, and walks home to the room, however far.
import { expect, type Page, test } from "@playwright/test";

import { lifeSaves } from "../../../packages/sim/src/goldens/lives.data";
import { passOpeningWords } from "./door";
import { doAct, LIVED, passCards, placeReady, seedSave } from "./live";

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] } });

/** Ada's second life a few months into London on a sponsored job (she lands at command 420), as the catalog opens it. */
const ADA_IN_LONDON = 440;

/** The city's probe; only its place and readiness are read here. */
type CityProbe = { ready?: boolean; place?: string } | undefined;

function adaInLondon(): string {
  const save = lifeSaves["ada-abroad"];
  if (save === undefined) throw new Error("No recorded life ada-abroad.");
  return JSON.stringify({ save: { ...save, commands: save.commands.slice(0, ADA_IN_LONDON) }, clock: { anchor: 0 } });
}

/** The pounds in the band, as whole pounds. */
async function pounds(page: Page): Promise<number> {
  const said = (await page.locator("[data-band] [data-band-money]").first().textContent()) ?? "";
  return Number(said.replace(/[^\d]/g, ""));
}

/** Every card over the world passed, and an act's own line put away by its Done. */
async function clear(page: Page): Promise<void> {
  for (let round = 0; round < 3; round += 1) {
    const done = page.getByRole("dialog").getByRole("button", { name: "Done", exact: true });
    if (await done.first().isVisible().catch(() => false)) await done.first().click();
    await passCards(page);
    const teach = page.locator("[data-home-teach-ok]");
    if (await teach.isVisible().catch(() => false)) await teach.click();
    await page.waitForTimeout(300);
  }
}

/** The map opened on London's painted paper, a stop picked from the list kept for a screen reader, and its ride sheet. */
async function pickStop(page: Page, stop: string): Promise<void> {
  await page.locator('[data-thumb="map"]').click();
  await page.waitForFunction(() => (window as unknown as { __map?: { ready?: boolean } }).__map?.ready === true, null, { timeout: 60_000 });
  await page.locator(`[data-stop="${stop}"]`).waitFor({ state: "attached", timeout: 20_000 });
  await page.evaluate((id) => document.querySelector<HTMLButtonElement>(`[data-stop="${id}"]`)?.click(), stop);
  await page.locator(`[data-ride-sheet="${stop}"]`).waitFor({ timeout: 10_000 });
}

/** A way chosen on the ride sheet and taken; the place opens once the ride has played. */
async function rideBy(page: Page, stop: string, way: string): Promise<void> {
  await page.locator(`[data-ride-sheet="${stop}"] [data-way="${way}"]`).click();
  await page.locator(`[data-ride-sheet="${stop}"] [data-ride-main]`).click();
  await page.waitForFunction((id) => {
    const city = (window as unknown as { __city?: CityProbe }).__city;
    return city?.place === id && city.ready === true;
  }, stop, { timeout: 120_000 });
  await clear(page);
}

test("[R-WORLD-039] [R-PLACE-012] [R-STREET-012] given Ada landed in London, when she buys the bus pass, rides the bus to the big shop, does the weekly shop, takes the train to the office and walks home, then the bus asks nothing, the shop and the train take pounds, and she ends in the room", async ({ page }) => {
  test.setTimeout(420_000);
  await seedSave(page, adaInLondon());
  await page.goto(`/${LIVED}&clock=afternoon`);
  await expect(page.locator("[data-band]")).toBeVisible({ timeout: 60_000 });
  await passOpeningWords(page);
  await clear(page);
  await placeReady(page);
  await clear(page);

  // R-WORLD-038: London is a painted map; its stops list stays for a screen reader.
  await pickStop(page, "place.peckham-rye-station");
  await expect(page.locator("[data-paper-map]").first()).toBeAttached();
  await rideBy(page, "place.peckham-rye-station", "walk");

  // R-PLACE-012: the ticket machine sells the month's bus pass, £95 from the pounds.
  const before = await pounds(page);
  await doAct(page, "ticket-machine", "bus-pass");
  await expect.poll(() => pounds(page), { timeout: 20_000 }).toBe(before - 95);
  await clear(page);

  // R-WORLD-039: in a pass month the bus says "£0, bus pass" and asks nothing.
  await pickStop(page, "place.big-shop-uk");
  await expect(page.locator('[data-ride-sheet="place.big-shop-uk"] [data-way="bus"]')).toContainText("£0, bus pass");
  const beforeBus = await pounds(page);
  await rideBy(page, "place.big-shop-uk", "bus");
  expect(await pounds(page)).toBe(beforeBus);

  // R-STREET-012: the weekly shop at the trolleys, £45.
  await doAct(page, "trolley", "weekly-shop");
  await expect.poll(() => pounds(page), { timeout: 20_000 }).toBe(beforeBus - 45);
  await clear(page);

  // The train still asks its fare by distance (R-PLACE-010 as amended 16 Oct 2026).
  await pickStop(page, "place.office-uk");
  const train = page.locator('[data-ride-sheet="place.office-uk"] [data-way="train"]');
  await expect(train).toContainText("£");
  await expect(train).not.toContainText("bus pass");
  const beforeTrain = await pounds(page);
  await rideBy(page, "place.office-uk", "train");
  await expect.poll(() => pounds(page), { timeout: 20_000 }).toBeLessThan(beforeTrain);

  // Home on foot, however far: the room is always walkable (R-PLACE-010, R-WORLD-017).
  await pickStop(page, "place.the-room");
  await expect(page.locator('[data-ride-sheet="place.the-room"] [data-way="walk"]')).not.toHaveAttribute("data-shut", "far");
  await rideBy(page, "place.the-room", "walk");
});

/** The card the track stands on, read where its scroll stands, and whether its piece of the paper is drawn with the stop ringed. */
async function cardUnderTheSheet(page: Page, stop: string): Promise<{ card: string | null; drawn: boolean; ringed: boolean }> {
  return page.evaluate((id) => {
    const track = document.querySelector<HTMLElement>("[data-track]");
    if (track === null) return { card: null, drawn: false, ringed: false };
    const slots = [...track.querySelectorAll<HTMLElement>("[data-card]")];
    const card = slots[Math.round(track.scrollLeft / Math.max(1, track.clientWidth))] ?? null;
    if (card === null) return { card: null, drawn: false, ringed: false };
    return { card: card.dataset.card ?? null, drawn: (card.querySelector(".paper-card-in")?.childElementCount ?? 0) > 0, ringed: card.querySelector(`[data-pin="${id}"][data-ring="picked"]`) !== null };
  }, stop);
}

test("[R-WORLD-038] [R-WORLD-015] given London's map folded on Peckham, when the office at London Bridge is picked across the city, then the card under the open sheet is its district's, drawn with the office ringed, from the moment the sheet is up", async ({ page }) => {
  test.setTimeout(180_000);
  await seedSave(page, adaInLondon());
  await page.goto(`/${LIVED}&clock=afternoon`);
  await expect(page.locator("[data-band]")).toBeVisible({ timeout: 60_000 });
  await passOpeningWords(page);
  await clear(page);
  await placeReady(page);
  await clear(page);
  await page.locator('[data-thumb="map"]').click();
  await page.waitForFunction(() => (window as unknown as { __map?: { ready?: boolean; card?: string } }).__map?.ready === true, null, { timeout: 60_000 });
  expect(await page.evaluate(() => (window as unknown as { __map?: { card?: string } }).__map?.card)).toBe("peckham");
  await page.evaluate(() => document.querySelector<HTMLButtonElement>('[data-stop="place.office-uk"]')?.click());
  await page.locator('[data-ride-sheet="place.office-uk"]').waitFor({ timeout: 10_000 });
  // At once, and again once everything has settled: never a blank card passed on the way.
  for (const wait of [80, 1500]) {
    await page.waitForTimeout(wait);
    expect(await cardUnderTheSheet(page, "place.office-uk")).toEqual({ card: "elephant", drawn: true, ringed: true });
  }
});
