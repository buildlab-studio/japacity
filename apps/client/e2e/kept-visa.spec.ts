// A Graduate visa kept through a trip home, in a real browser on a phone (return:papers-return-keeps-status, place:return-shape-decided-at-once,
// status:absence-breaks-settlement): a developer's life played in the engine to London on the Graduate visa with months left, kept as the save the
// browser opens. The room's bag says the return keeps the visa and names the month it runs to; the life goes home, Papers says the visa runs on and
// the life can fly back on it, and the airport's gate flies it back to London on the same visa, the flight alone paid.
import { lastSegment, lifeStart, savedCommands, type FlatSave } from "@japacity/sim";
import { runLife } from "@japacity/sim/testing";
import { devices, expect } from "@playwright/test";
import { test } from "./support/policy";

import { content, text } from "../../../packages/content/src/index";
import { clear, pickStop, rideBy } from "./support/abroad";
import { SOFTWARE_WEBGL } from "./support/browser";
import { passOpeningWords } from "./support/door";
import { boardThroughTheScene, doAct, LIVED, openApp, passCards, placeNow, placeReady, putPhoneAway, rideTo, seedSave } from "./support/live";
import { kept } from "./support/saves";

const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices["Pixel 7"];
test.use({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch, launchOptions: SOFTWARE_WEBGL });

const GRADUATE = "status.uk-graduate";

/** A line's words with each named figure as any text, so a month's name read from the life's own start is matched whatever it is. */
function shaped(key: string, fixed: Record<string, string>): RegExp {
  const words = text[key] ?? key;
  const escaped = words.replace(/[.*+?^$()|[\]\\]/g, "\\$&");
  return new RegExp(escaped.replace(/\\?\{(\w+)\\?\}/g, (_: string, name: string) => (fixed[name] === undefined ? ".+" : fixed[name].replace(/[.*+?^$()|[\]\\]/g, "\\$&"))));
}

/** The developer's spending life, played in the engine to London on the Graduate visa with months left and a return with papers forecast. */
function graduateVisaSave(): string {
  const { game } = runLife("spender", "scenario.developer", "kept-0", content, { months: 90, worldSeed: "golden-world", keepSave: true });
  const view = game.view();
  if (view.place.where !== "abroad" || view.status?.entry !== GRADUATE || (view.status.monthsLeft ?? 0) < 6 || view.place.wayHome?.shape !== "with-papers" || game.state.setpiece.open !== null) {
    throw new Error(`The life is not in the UK on the Graduate visa with a return with papers: ${JSON.stringify({ status: view.status, wayHome: view.place.wayHome })}.`);
  }
  const begun = lifeStart(game.save);
  if (begun === null) throw new Error("The life starts from its scenario.");
  const save: FlatSave = { schema: 2, content: lastSegment(game.save).content, ...begun, commands: savedCommands(game.save) };
  return kept(save);
}

test("[return:papers-return-keeps-status] [place:return-shape-decided-at-once] given a life in London on the Graduate visa, when it goes home from the room's bag and then flies back from the airport's gate, then the card and Papers say the visa runs on and can be flown back on, and the life lands in London on the same visa", async ({ page }, info) => {
  test.skip(info.project.name !== "Pixel 7", "The trip home and back is played at phone size");
  test.setTimeout(480_000);
  await seedSave(page, graduateVisaSave());
  await page.goto(`/${LIVED}&clock=afternoon`);
  await expect(page.locator("[data-band]")).toBeVisible({ timeout: 60_000 });
  await passOpeningWords(page);
  await clear(page);
  await placeReady(page);
  await clear(page);

  // To the room abroad, on foot: the life holds next to no pounds, and a walk home is never refused for want of a fare.
  if ((await placeNow(page)) !== "place.the-room") {
    await pickStop(page, "place.the-room");
    await rideBy(page, "place.the-room", "walk");
  }
  await clear(page);
  await doAct(page, "bag", "go-home");
  const card = page.getByRole("dialog");
  await expect(card).toBeVisible();
  await expect(card).toContainText(text["ui.world.go-home.line.with-papers"]!);
  await expect(card.locator("[data-ask-facts]")).toContainText(shaped("ui.world.go-home.kept", { status: text[`${GRADUATE}.name`]! }));
  await expect(card.locator("[data-ask-facts]")).not.toContainText(text["ui.world.go-home.status"]!);
  await card.locator("[data-ask-main]").click();

  // Home with the visa kept: Papers says the month it runs to and the flight back.
  await page.waitForFunction(() => {
    const city = (window as unknown as { __city?: { place?: string; ready?: boolean } }).__city;
    return city?.ready === true && city.place !== undefined && city.place !== "place.the-room" && !city.place.endsWith("-uk");
  }, null, { timeout: 90_000 });
  await clear(page);
  const papers = await openApp(page, "papers");
  await expect(papers.locator("[data-papers-place='home']")).toContainText(text["ui.place.shape.with-papers"]!);
  await expect(papers.locator("[data-papers-kept]")).toContainText(shaped("ui.place.kept.until", { status: text[`${GRADUATE}.name`]! }));
  await putPhoneAway(page);

  // The airport's gate flies the kept visa back, the flight alone paid.
  await rideTo(page, "place.airport-lagos");
  await doAct(page, "gate", "depart");
  await boardThroughTheScene(page);
  await passCards(page);
  await placeReady(page);
  await expect(page.locator("[data-band]")).toContainText("£");
  const japa = await openApp(page, "japa");
  await expect(japa.locator(`[data-japa-visa="${GRADUATE}"]`)).toBeVisible();
});
