// Castel Volturno on the mold in a real browser at phone size (world:painted-maps-abroad, world:ride-abroad-and-workplace;
// place:rides-between-city-places, place:employer-shuttle-rides-free; streets:castel-volturno-by-hand): a life that took the road, played by a simulated
// player, lands on the coast holding the farm's cash job. Italy has no pass, so the bus is paid each time: the van to the
// fields asks nothing and the gangmaster's table says On shift, the van back to the roundabout asks nothing, the coast
// road's bus to the discount supermarket asks its flat fare, and the weekly shop takes euros.
import { expect, test } from "@playwright/test";

import { SOFTWARE_WEBGL } from "./support/browser";
import { type AbroadLife, clear, lifeIn, money, pickStop, rideBy, standing } from "./support/abroad";
import { passOpeningWords } from "./support/door";
import { doAct, LIVED, placeReady, seedSave } from "./support/live";

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, launchOptions: SOFTWARE_WEBGL });

/** The simulated risky player from the front door's life takes the road and reaches Castel Volturno in month 28, at the farm. */
const ROAD: AbroadLife = { strategy: "risky", life: "scenario.prologue", seed: "three-prologue-0", country: "country.italy", money: "EUR", holding: 60_000 };

test("[world:ride-abroad-and-workplace] [place:employer-shuttle-rides-free] [streets:castel-volturno-by-hand] given a road life landed at Castel Volturno, when it rides the van to the fields and back and the bus to the discount supermarket for the weekly shop, then the van asks nothing either way, the table says On shift, the bus asks its flat fare and the shop takes euros", async ({ page }) => {
  test.setTimeout(480_000);
  await seedSave(page, lifeIn(ROAD));
  await page.goto(`/${LIVED}&clock=afternoon`);
  await expect(page.locator("[data-band]")).toBeVisible({ timeout: 60_000 });
  await passOpeningWords(page);
  await clear(page);
  await placeReady(page);
  await clear(page);

  // world:painted-maps-abroad: the coast is a painted map of its own, Naples on its inset; the stops list for a screen reader.
  // place:employer-shuttle-rides-free: the van to the fields says €0, the van, plays in the van, and the gangmaster's table says On shift.
  await pickStop(page, "place.farm-italy");
  await expect(page.locator("[data-paper-map]").first()).toBeAttached();
  await expect(page.locator('[data-ride-sheet="place.farm-italy"] [data-way="bus"]')).toContainText("the van");
  const beforeVan = await money(page);
  expect(await rideBy(page, "place.farm-italy", "bus")).toBe("van");
  expect(await money(page)).toBe(beforeVan);
  await expect(page.locator('[data-mark="table"]')).toContainText("On shift", { timeout: 20_000 });

  // The van back to the roundabout asks nothing too.
  await pickStop(page, "place.castel-volturno");
  await expect(page.locator('[data-ride-sheet="place.castel-volturno"] [data-way="bus"]')).toContainText("the van");
  expect(await rideBy(page, "place.castel-volturno", "bus")).toBe("van");
  expect(await money(page)).toBe(beforeVan);
  expect(await standing(page)).toBe("place.castel-volturno");

  // The coast road's bus to the discount supermarket asks its flat fare, €1.60, and Italy has no pass to say otherwise.
  await pickStop(page, "place.big-shop-italy");
  const bus = page.locator('[data-ride-sheet="place.big-shop-italy"] [data-way="bus"]');
  await expect(bus).toContainText("1.60");
  await expect(bus).not.toContainText("pass");
  const beforeBus = await money(page);
  expect(await rideBy(page, "place.big-shop-italy", "bus")).toBe("italy-bus");
  await expect.poll(() => money(page), { timeout: 20_000 }).toBeLessThan(beforeBus + 1);

  // streets:castel-volturno-by-hand: the weekly shop at the trolleys, €35.
  const beforeShop = await money(page);
  await doAct(page, "trolley", "weekly-shop");
  await expect.poll(() => money(page), { timeout: 20_000 }).toBeLessThanOrEqual(beforeShop - 34);
  await clear(page);
});
