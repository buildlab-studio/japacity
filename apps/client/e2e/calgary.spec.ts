// Calgary on the mold in a real browser at phone size (docs/rules/world.md R-WORLD-038, R-WORLD-039; place.md
// R-PLACE-010, R-PLACE-012; streets.md R-STREET-013, R-STREET-014): a points life played by the sweep's own
// `canada` player lands in Calgary and takes the warehouse job, buys the month's transit pass at the CTrain station's ticket
// machine, rides the bus to the superstore for nothing and does the weekly shop, rides the CTrain to the warehouse, where
// the clock-in says On shift, and rides home, and the pass covers every ride of the month.
import { expect, test } from "@playwright/test";

import { type AbroadLife, clear, lifeIn, money, pickStop, rideBy } from "./abroad";
import { passOpeningWords } from "./door";
import { doAct, LIVED, placeReady, seedSave } from "./live";

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] } });

/** The sweep's canada player on Zainab's life, the recorded zainab-canada: lands in Calgary in month 42, the warehouse job hers in month 45. */
const POINTS: AbroadLife = { strategy: "canada", life: "scenario.zainab", seed: "golden-zainab-canada-0", country: "country.canada", money: "CAD", holding: 60_000 };

test("[R-WORLD-039] [R-PLACE-012] [R-STREET-013] [R-STREET-014] given a points life landed in Calgary, when it buys the transit pass, rides the bus to the superstore for the weekly shop, takes the CTrain to the warehouse and rides home, then no ride asks anything in the pass month, the shop takes dollars and the warehouse says On shift", async ({ page }) => {
  test.setTimeout(480_000);
  await seedSave(page, lifeIn(POINTS));
  await page.goto(`/${LIVED}&clock=afternoon`);
  await expect(page.locator("[data-band]")).toBeVisible({ timeout: 60_000 });
  await passOpeningWords(page);
  await clear(page);
  await placeReady(page);
  await clear(page);

  // R-WORLD-038: Calgary is a painted map of its own; its stops list stays for a screen reader.
  await pickStop(page, "place.ctrain-station-ca");
  await expect(page.locator("[data-paper-map]").first()).toBeAttached();
  await rideBy(page, "place.ctrain-station-ca", "bus");

  // R-PLACE-012: the ticket machine sells the month's transit pass, C$118.
  const before = await money(page);
  await doAct(page, "ticket-machine", "transit-pass");
  await expect.poll(() => money(page), { timeout: 20_000 }).toBe(before - 118);
  await clear(page);

  // In the pass month the bus says C$0, transit pass, and asks nothing; the ride plays in Calgary's bus.
  await pickStop(page, "place.big-shop-ca");
  await expect(page.locator('[data-ride-sheet="place.big-shop-ca"] [data-way="bus"]')).toContainText("transit pass");
  const beforeBus = await money(page);
  expect(await rideBy(page, "place.big-shop-ca", "bus")).toBe("calgary-bus");
  expect(await money(page)).toBe(beforeBus);

  // R-STREET-014: the weekly shop at the superstore's trolley bay, C$90.
  await doAct(page, "trolley", "weekly-shop");
  await expect.poll(() => money(page), { timeout: 20_000 }).toBe(beforeBus - 90);
  await clear(page);

  // The CTrain to the warehouse says C$0, transit pass, plays in the CTrain, and the clock-in says On shift.
  await pickStop(page, "place.warehouse-ca");
  await expect(page.locator('[data-ride-sheet="place.warehouse-ca"] [data-way="train"]')).toContainText("transit pass");
  const beforeTrain = await money(page);
  expect(await rideBy(page, "place.warehouse-ca", "train")).toBe("ctrain");
  expect(await money(page)).toBe(beforeTrain);
  await expect(page.locator('[data-mark="clock-in"]')).toContainText("On shift", { timeout: 20_000 });

  // And home on the bus, for nothing.
  await pickStop(page, "place.the-room");
  await expect(page.locator('[data-ride-sheet="place.the-room"] [data-way="bus"]')).toContainText("transit pass");
  expect(await rideBy(page, "place.the-room", "bus")).toBe("calgary-bus");
  expect(await money(page)).toBe(beforeTrain);
});
