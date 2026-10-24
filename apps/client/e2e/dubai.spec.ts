// Dubai, built as Lagos is, in a real browser at phone size (world:painted-maps-abroad, world:ride-abroad-and-workplace; place.md
// place:rides-between-city-places, place:country-pass-covers-ways, place:employer-shuttle-rides-free; streets:dubai-life-by-hand): a contract life played by a simulated
// player lands in Dubai holding the guard's job, buys the month's zone pass at Union station's Nol machine, rides the bus
// to the hypermarket for nothing and does the weekly shop, rides the labour bus to the site, where the guard's post says
// On shift, and back to the camp, and the shuttle asks nothing either way.
import { expect } from "@playwright/test";
import { test } from "./support/policy";

import { SOFTWARE_WEBGL } from "./support/browser";
import { type AbroadLife, clear, lifeIn, money, pickStop, rideBy } from "./support/abroad";
import { passOpeningWords } from "./support/door";
import { doAct, LIVED, placeReady, seedSave } from "./support/live";

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, launchOptions: SOFTWARE_WEBGL });

/** The simulated borrower on the graduate's life takes the Gulf contract and lands in Dubai in month 10, the guard's job its own. */
const GULF: AbroadLife = { strategy: "borrower", life: "scenario.graduate", seed: "three-ada-0", country: "country.uae", money: "AED", holding: 60_000 };

test("[world:ride-abroad-and-workplace] [place:country-pass-covers-ways] [place:employer-shuttle-rides-free] [streets:dubai-life-by-hand] given a contract life landed in Dubai, when it buys the zone pass, rides to the hypermarket for the weekly shop and takes the labour bus to the site and back, then the bus asks nothing in the pass month, the shop takes dirhams, the site says On shift and the shuttle is free both ways", async ({ page }) => {
  test.setTimeout(480_000);
  await seedSave(page, lifeIn(GULF));
  await page.goto(`/${LIVED}&clock=afternoon`);
  await expect(page.locator("[data-band]")).toBeVisible({ timeout: 60_000 });
  await passOpeningWords(page);
  await clear(page);
  await placeReady(page);
  await clear(page);

  // world:painted-maps-abroad: Dubai is a painted map of its own; its stops list stays for a screen reader.
  await pickStop(page, "place.metro-station-uae");
  await expect(page.locator("[data-paper-map]").first()).toBeAttached();
  await rideBy(page, "place.metro-station-uae", "bus");

  // place:country-pass-covers-ways: the Nol machine sells the month's zone pass, AED 140.
  const before = await money(page);
  await doAct(page, "nol-machine", "transit-pass");
  await expect.poll(() => money(page), { timeout: 20_000 }).toBe(before - 140);
  await clear(page);

  // In the pass month the bus says AED 0, zone pass, and asks nothing; the ride plays in Dubai's bus.
  await pickStop(page, "place.big-shop-uae");
  await expect(page.locator('[data-ride-sheet="place.big-shop-uae"] [data-way="bus"]')).toContainText("zone pass");
  const beforeBus = await money(page);
  expect(await rideBy(page, "place.big-shop-uae", "bus")).toBe("dubai-bus");
  expect(await money(page)).toBe(beforeBus);

  // streets:dubai-life-by-hand: the weekly shop at the hypermarket's trolleys, AED 150.
  await doAct(page, "trolley", "weekly-shop");
  await expect.poll(() => money(page), { timeout: 20_000 }).toBe(beforeBus - 150);
  await clear(page);

  // place:employer-shuttle-rides-free: the labour bus to the site says AED 0, site bus, plays in the labour bus, and the site says On shift.
  await pickStop(page, "place.site-uae");
  await expect(page.locator('[data-ride-sheet="place.site-uae"] [data-way="bus"]')).toContainText("site bus");
  const beforeSite = await money(page);
  expect(await rideBy(page, "place.site-uae", "bus")).toBe("labour-bus");
  expect(await money(page)).toBe(beforeSite);
  await expect(page.locator('[data-mark="guard-post"]')).toContainText("On shift", { timeout: 20_000 });

  // And back to the camp on the labour bus, for nothing.
  await pickStop(page, "place.the-room");
  await expect(page.locator('[data-ride-sheet="place.the-room"] [data-way="bus"]')).toContainText("site bus");
  expect(await rideBy(page, "place.the-room", "bus")).toBe("labour-bus");
  expect(await money(page)).toBe(beforeSite);
});
