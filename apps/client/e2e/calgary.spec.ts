// Calgary on the mold in a real browser at phone size (world:painted-maps-abroad, world:ride-abroad-and-workplace; place.md
// place:rides-between-city-places, place:country-pass-covers-ways; streets:calgary-life-by-hand, streets:dubai-life-by-hand): a points life played by a simulated
// `canada` player lands in Calgary and takes the warehouse job, buys the month's transit pass at the CTrain station's ticket
// machine, rides the bus to the superstore for nothing and does the weekly shop, rides the CTrain to the warehouse, where
// the clock-in says On shift, and rides home, and the pass covers every ride of the month.
import { expect, test } from "@playwright/test";

import { SOFTWARE_WEBGL } from "./support/browser";
import { type AbroadLife, clear, lifeIn, money, pickStop, rideBy } from "./support/abroad";
import { passOpeningWords } from "./support/door";
import { doAct, LIVED, placeReady, seedSave } from "./support/live";

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, launchOptions: SOFTWARE_WEBGL });

/** The simulated canada player on Zainab's life, the recorded zainab-canada: lands in Calgary in month 42, the warehouse job hers in month 45. */
const POINTS: AbroadLife = { strategy: "canada", life: "scenario.zainab", seed: "golden-zainab-canada-0", country: "country.canada", money: "CAD", holding: 60_000 };

test("[world:ride-abroad-and-workplace] [place:country-pass-covers-ways] [streets:calgary-life-by-hand] [streets:dubai-life-by-hand] given a points life landed in Calgary, when it buys the transit pass, rides the bus to the superstore for the weekly shop, takes the CTrain to the warehouse and rides home, then no ride asks anything in the pass month, the shop takes dollars and the warehouse says On shift", async ({ page }) => {
  test.setTimeout(480_000);
  await seedSave(page, lifeIn(POINTS));
  await page.goto(`/${LIVED}&clock=afternoon`);
  await expect(page.locator("[data-band]")).toBeVisible({ timeout: 60_000 });
  await passOpeningWords(page);
  await clear(page);
  await placeReady(page);
  await clear(page);

  // world:painted-maps-abroad: Calgary is a painted map of its own; its stops list stays for a screen reader.
  await pickStop(page, "place.ctrain-station-canada");
  await expect(page.locator("[data-paper-map]").first()).toBeAttached();
  await rideBy(page, "place.ctrain-station-canada", "bus");

  // place:country-pass-covers-ways: the ticket machine sells the month's transit pass, C$118.
  const before = await money(page);
  await doAct(page, "ticket-machine", "transit-pass");
  await expect.poll(() => money(page), { timeout: 20_000 }).toBe(before - 118);
  await clear(page);

  // In the pass month the bus says C$0, transit pass, and asks nothing; the ride plays in Calgary's bus.
  await pickStop(page, "place.big-shop-canada");
  await expect(page.locator('[data-ride-sheet="place.big-shop-canada"] [data-way="bus"]')).toContainText("transit pass");
  const beforeBus = await money(page);
  expect(await rideBy(page, "place.big-shop-canada", "bus")).toBe("calgary-bus");
  expect(await money(page)).toBe(beforeBus);

  // streets:dubai-life-by-hand: the weekly shop at the superstore's trolley bay, C$90.
  await doAct(page, "trolley", "weekly-shop");
  await expect.poll(() => money(page), { timeout: 20_000 }).toBe(beforeBus - 90);
  await clear(page);

  // The CTrain to the warehouse says C$0, transit pass, plays in the CTrain, and the clock-in says On shift.
  await pickStop(page, "place.warehouse-canada");
  await expect(page.locator('[data-ride-sheet="place.warehouse-canada"] [data-way="train"]')).toContainText("transit pass");
  const beforeTrain = await money(page);
  expect(await rideBy(page, "place.warehouse-canada", "train")).toBe("ctrain");
  expect(await money(page)).toBe(beforeTrain);
  await expect(page.locator('[data-mark="clock-in"]')).toContainText("On shift", { timeout: 20_000 });

  // And home on the bus, for nothing.
  await pickStop(page, "place.the-room");
  await expect(page.locator('[data-ride-sheet="place.the-room"] [data-way="bus"]')).toContainText("transit pass");
  expect(await rideBy(page, "place.the-room", "bus")).toBe("calgary-bus");
  expect(await money(page)).toBe(beforeTrain);
});
