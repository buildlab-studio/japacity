// An overstay walked to the way home in a real browser at phone size (status:view-shows-status, place:view-carries-way-home,
// place:returns-service-takes-you-home, world:costly-acts-confirmed): the graduate's second life in London leaves its sponsored job, the clock
// runs out, the visa lapses and the grace passes, played in the engine and kept as the save the browser opens. Then Papers and
// the warning over the phone's apps say the life is overstaying, the room's bag says when the life can come back and offers
// the returns service, which asks once more before it goes, and the life lands at home.
import { lastSegment, lifeStart, savedCommands, type FlatSave } from "@japacity/sim";
import { lifeSaves, start } from "@japacity/sim/testing";
import { expect, test } from "@playwright/test";

import { content, text } from "../../../packages/content/src/index";
import { clear, pickStop, rideBy } from "./support/abroad";
import { SOFTWARE_WEBGL } from "./support/browser";
import { passOpeningWords } from "./support/door";
import { doAct, LIVED, openApp, placeNow, placeReady, putPhoneAway, seedSave } from "./support/live";
import { kept } from "./support/saves";

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, launchOptions: SOFTWARE_WEBGL });

/** The graduate's second life a few months into London on a sponsored job, as london.spec.ts opens it. */
const GRADUATE_IN_LONDON = 392;
/** The months played after the job is left: the clock's month, the grace's two, and one past it. */
const MONTHS_AFTER = 4;

function say(key: string, params: Record<string, string | number> = {}): string {
  return (text[key] ?? key).replace(/\{(\w+)\}/g, (_: string, name: string) => String(params[name] ?? ""));
}

/** The life played on in the engine from London: the job left, the months slept through until the grace has passed. */
function overstayingSave(): string {
  const recorded = lifeSaves["graduate-abroad"];
  if (recorded === undefined) throw new Error("No recorded graduate-abroad life.");
  const begun = lifeStart(recorded);
  if (begun === null) throw new Error("The recorded life starts from its scenario.");
  const game = start({ ...begun, content });
  for (const { command, tick, sender } of savedCommands(recorded).slice(0, GRADUATE_IN_LONDON)) {
    game.tick = tick;
    game.accept(command, sender);
  }
  game.accept({ type: "activity/quit" });
  for (let month = 0; month < MONTHS_AFTER; month += 1) game.endTurn([]);
  const view = game.view();
  if (view.status?.overstay === null || view.status?.overstay === undefined || view.status.overstay.graceLeft > 0 || view.place.wayHome?.scheme === null) {
    throw new Error(`The life is not past its grace on an overstay with the returns service: ${JSON.stringify(view.status?.overstay ?? null)}.`);
  }
  const save: FlatSave = { schema: 2, content: lastSegment(game.save).content, ...begun, commands: savedCommands(game.save) };
  return kept(save);
}

test("[status:view-shows-status] [place:view-carries-way-home] [place:returns-service-takes-you-home] [world:costly-acts-confirmed] given the graduate overstaying in London past the grace, when the phone is opened and the bag's Go home is tapped, then the stage is said in plain words, the card says when the life can come back and offers the returns service, which asks once more, and the life goes home", async ({ page }) => {
  test.setTimeout(420_000);
  await seedSave(page, overstayingSave());
  await page.goto(`/${LIVED}&clock=afternoon`);
  await expect(page.locator("[data-band]")).toBeVisible({ timeout: 60_000 });
  await passOpeningWords(page);
  await clear(page);
  await placeReady(page);
  await clear(page);

  // status:view-shows-status: Papers says the stage in plain words, and so does the warning over every app.
  const papers = await openApp(page, "papers");
  await expect(papers.locator('[data-overstay="over"]')).toContainText(say("ui.status.overstay.over"));
  await expect(papers.locator('[data-overstay="over"]')).toContainText(say("ui.status.overstay.over-line.country.uk"));
  await expect(page.locator('[data-overstay-banner="over"]')).toBeVisible();
  await putPhoneAway(page);

  // To the room abroad, where the bag carries Go home.
  if ((await placeNow(page)) !== "place.the-room") {
    await pickStop(page, "place.the-room");
    await rideBy(page, "place.the-room", "bus");
  }
  await clear(page);
  await doAct(page, "bag", "go-home");
  const card = page.getByRole("dialog");
  await expect(card).toBeVisible();
  // place:leaving-an-overstay-bans: going home at one's own fare past the grace bans a year.
  await expect(card).toContainText(say("ui.world.go-home.ban", { months: 12 }));
  const other = card.locator("[data-ask-other]");
  await expect(other).toContainText(say("ui.world.go-home.scheme"));
  await other.getByRole("button", { name: say("ui.world.go-home.scheme") }).click();

  // world:costly-acts-confirmed: asked once more with the ban named; the safe choice is the main button, the service in the warning colour apart.
  const sure = card.locator("[data-ask-sure]");
  await expect(sure).toContainText(say("ui.world.go-home.scheme.sure", { months: 24 }));
  await expect(card.locator("[data-ask-main]")).toHaveCount(0);
  await sure.getByRole("button", { name: say("ui.world.go-home.scheme.go") }).click();

  // place:returns-service-takes-you-home: the ticket is the service's, and the life lands at home.
  await page.waitForFunction(() => {
    const city = (window as unknown as { __city?: { place?: string } }).__city;
    return city?.place !== undefined && city.place !== "place.the-room" && !city.place.endsWith("-uk");
  }, null, { timeout: 90_000 });
  const papersHome = await openApp(page, "papers");
  await expect(papersHome.locator("[data-papers-place='home']")).toContainText(say("ui.place.shape.assisted"));
});
