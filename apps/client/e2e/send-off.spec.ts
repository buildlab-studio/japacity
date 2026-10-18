// The send-off as a scene in a real browser on a phone (docs/rules/chapter.md R-CHAPTER-012, world.md R-WORLD-037,
// share.md R-SHARE-015): Ada's recorded life, granted, rides to the airport, and the gate's act opens the six beats in
// place of the card the flight was. Departures with three taps of Step forward and a line a tap, the counter's stub and
// Window or aisle, the gate where Board the plane sends the flight once, the plane over the night map, the landing in
// Peckham with the bus, the top deck with the pings, the card saved and the Phone's badge; Ring the bell and the life
// stands in the room abroad, the card kept where the phone keeps it.
import { lifeSaves } from "@japacity/sim/testing";
import { devices, expect, test, type Page } from "@playwright/test";

import { text } from "../../../packages/content/src/index";
import { SOFTWARE_WEBGL } from "./support/browser";
import { closeGranted, doAct, LIVED, passCards, placeNow, placeReady, rideTo, seedSave } from "./support/live";

// The world's scene needs WebGL, drawn in software where the machine has no GPU (as world.spec.ts draws it).
const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices["Pixel 7"];
test.use({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch, launchOptions: SOFTWARE_WEBGL });

/** Ada's recorded life up to the month before she flies. */
function adaBeforeFlight(): string {
  const save = lifeSaves["ada-careful"];
  if (save === undefined) throw new Error("No recorded life ada-careful.");
  return JSON.stringify({ save: { ...save, commands: save.commands.slice(0, -1) }, clock: { anchor: 0 } });
}

/** How many times the flight is in the save the page keeps: each command played is written there as it lands. */
async function departures(page: Page): Promise<number> {
  return page.evaluate(() => (localStorage.getItem("japacity.save") ?? "").split('"type":"route/depart"').length - 1);
}

test("[R-CHAPTER-012] [R-WORLD-037] [R-SHARE-015] a granted life boards through the six beats of the send-off and lands in the room abroad with the card kept on the phone", async ({ page }, info) => {
  test.skip(info.project.name !== "Pixel 7", "The send-off is played at phone size");
  test.setTimeout(240_000);
  await seedSave(page, adaBeforeFlight());
  await page.goto(`/${LIVED}`);
  await closeGranted(page);
  await placeReady(page);
  await rideTo(page, "place.airport-lagos");
  await doAct(page, "gate", "depart");

  // Beat 1: Departures, the queue two ahead and Mama's line; three taps, a line a tap, the character's own last.
  const scene = page.locator("[data-send-off]");
  await expect(scene).toHaveAttribute("data-send-off", "departures");
  await expect(page.locator("[data-ask-main]")).toHaveCount(0);
  await expect(scene.locator("[data-so-marker]")).toContainText("2 ahead");
  await expect(scene.locator("[data-so-said='mum']")).toContainText(text["place.airport-lagos.overheard.1"]!);
  const step = scene.locator("[data-so-go='step']");
  await step.click();
  await expect(scene.locator("[data-so-said='cousin']")).toContainText(text["place.airport-lagos.overheard.2"]!);
  await step.click();
  await expect(scene.locator("[data-so-said='dad']")).toContainText(text["place.airport-lagos.overheard.4"]!);
  await step.click();
  await expect(scene.locator("[data-so-said='you']")).toContainText(text["place.airport-lagos.overheard.5"]!);
  expect(await departures(page)).toBe(0);

  // Beat 2: the counter, the flight's figure from the tuning, Window or aisle on the stub.
  await expect(scene).toHaveAttribute("data-send-off", "counter", { timeout: 5000 });
  await expect(scene.locator("[data-so-flight]")).toContainText("₦1,600,000");
  await scene.locator("[data-so-seat-chip='aisle']").click();
  await expect(scene.locator("[data-so-stub]")).toContainText(text["share.stub.seat.aisle"]!);
  await scene.locator("[data-so-go='take']").click();

  // Beat 3: the gate, Papa's line, and Board the plane, which alone sends the flight.
  await expect(scene).toHaveAttribute("data-send-off", "gate");
  await expect(scene.locator("[data-so-said='dad']")).toContainText(text["place.airport-lagos.overheard.6"]!);
  expect(await departures(page)).toBe(0);
  await scene.locator("[data-so-go='board']").click();

  // Beat 4: the plane over the night map, about three seconds, then Peckham.
  await expect(scene).toHaveAttribute("data-send-off", "plane");
  await expect(scene.locator("[data-plane-city]")).toContainText("London");
  await expect(scene.locator("[data-paper-svg]")).toHaveCount(1);
  await expect(scene).toHaveAttribute("data-send-off", "landing", { timeout: 6000 });
  expect(await departures(page)).toBe(1);

  // Beat 5: out into Peckham, the first line at the stop, the bus with the hub on its blind.
  await expect(scene.locator("[data-so-said='stop']")).toContainText(text["place.peckham.overheard.1"]!);
  await expect(scene.locator("[data-so-blind]")).toContainText("PECKHAM");
  await scene.locator("[data-so-go='ride']").click();

  // Beat 6: the top deck, the pings, the card saved, the Phone's badge counting them; Ring the bell.
  await expect(scene).toHaveAttribute("data-send-off", "ride");
  await expect(scene.locator("[data-so-ping]")).toHaveCount(3);
  await expect(scene.locator("[data-so-ping='0']")).toContainText(text["chats.mum.landed.text"]!);
  await expect(scene.locator("[data-so-saved]")).toContainText("Send-off card saved");
  await expect(scene.locator("[data-so-badge]")).toHaveAttribute("data-so-badge", "3");
  await scene.locator("[data-so-go='ring']").click();
  await expect(scene).toHaveCount(0);

  // The life in the room abroad; the landing's moment, then no share card of its own (R-SHARE-015).
  await passCards(page);
  await placeReady(page);
  expect(await placeNow(page)).not.toBe("place.airport-lagos");
  await expect(page.locator("[data-band]")).toContainText("£");
  await expect(page.locator("[data-share-card]")).toHaveCount(0);
  expect(await departures(page)).toBe(1);

  // The card where the phone keeps the cards, the stub carrying the seat.
  await page.locator('[data-thumb="phone"]').click();
  const keepsake = page.locator("[data-keepsake]");
  await expect(keepsake).toBeVisible();
  await keepsake.locator("[data-keepsake-open]").click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.locator("[data-share-card='send-off']")).toBeVisible();
  await sheet.locator("[data-pick='stub']").click();
  await expect(sheet.locator("[data-stub-seat]")).toHaveText(text["share.stub.seat.aisle"]!);
});

test("[R-CHAPTER-012] leaving the scene before the gate's button leaves the life at the airport, and the act opens it again", async ({ page }, info) => {
  test.skip(info.project.name !== "Pixel 7", "The send-off is played at phone size");
  test.setTimeout(180_000);
  await seedSave(page, adaBeforeFlight());
  await page.goto(`/${LIVED}`);
  await closeGranted(page);
  await placeReady(page);
  await rideTo(page, "place.airport-lagos");
  await doAct(page, "gate", "depart");
  const scene = page.locator("[data-send-off]");
  await scene.locator("[data-so-go='step']").click();
  await scene.locator("[data-so-leave]").click();
  await expect(scene).toHaveCount(0);
  expect(await placeNow(page)).toBe("place.airport-lagos");
  expect(await departures(page)).toBe(0);
  await doAct(page, "gate", "depart");
  await expect(scene).toHaveAttribute("data-send-off", "departures");
  await expect(scene.locator("[data-so-beat='departures']")).toHaveAttribute("data-so-step", "0");
});
