import { expect, test, type Page } from "@playwright/test";

// The recorded lives are the simulation's own data, replayed here through the client's save.
import { content } from "../../../packages/content/src/index";
import { lifeSaves } from "../../../packages/sim/src/goldens/lives.data";
import { standInWorld } from "../../../packages/sim/src/world/standIn";

/** Text that must never reach the player: kobo, a raw object, a missing value, a words key with no words. */
const BROKEN: readonly [string, RegExp][] = [
  ["kobo or pence on money", /[₦£$]\d[\d,]*\.\d/],
  ["a raw object", /\[object Object\]/],
  ["a missing value", /\bundefined\b|\bNaN\b/],
  ["a words key with no words", /\b(?:line|ui|reject)\.[a-z-]+\.[a-z-]+/],
];

// The aboki rate is the one figure that keeps its kobo, so the rates table is left out.
async function shownText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const copy = document.body.cloneNode(true) as HTMLElement;
    for (const rates of copy.querySelectorAll("[data-rates]")) rates.remove();
    return copy.textContent;
  });
}

async function expectNothingBroken(page: Page, when: string): Promise<void> {
  const shown = await shownText(page);
  for (const [what, pattern] of BROKEN) expect(shown.match(pattern)?.[0], `${what} on screen ${when}`).toBeUndefined();
}

async function plan(page: Page, activity: string): Promise<void> {
  const add = page.getByRole("button", { name: `Add to month: ${activity}` });
  if (await add.isEnabled()) await add.click();
}

test("a new player picks a life, ends a month and reads the report", async ({ page }) => {
  await page.goto("/");

  // A fresh browser has no save, so the life chooser comes first.
  await expect(page.getByRole("heading", { name: "Who are you?" })).toBeVisible();
  await page.getByRole("button", { name: /^Live this life/ }).first().click();

  await expect(page.getByRole("heading", { name: "Month 1", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "End month" }).click();

  const report = page.getByRole("dialog");
  await expect(report).toBeVisible();
  await expect(report.getByRole("heading", { name: "Month 1" })).toBeVisible();
  await expect(report.getByText(/^Japacity: /)).toBeVisible();

  await report.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("heading", { name: "Month 2", exact: true })).toBeVisible();

  // The life survives a reload.
  await page.reload();
  await expect(page.getByRole("heading", { name: "Month 2", exact: true })).toBeVisible();
});

test("three months of play show no kobo, raw object, missing value or bare key", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Live this life/ }).first().click();
  await expect(page.getByRole("heading", { name: "Month 1", exact: true })).toBeVisible();
  await expectNothingBroken(page, "at the start");

  const months = [
    ["Look for a job", "Apply for a passport", "Ask around at the motor park"],
    ["Look for a job", "Take a side gig", "Study for the English test"],
    ["Take a side gig", "Rest", "Rest"],
  ];
  for (const [index, activities] of months.entries()) {
    const month = index + 1;
    for (const activity of activities) await plan(page, activity);
    await page.getByRole("button", { name: "End month" }).click();
    const report = page.getByRole("dialog");
    await expect(report.getByRole("heading", { name: `Month ${String(month)}` })).toBeVisible();
    await expectNothingBroken(page, `in the report for month ${String(month)}`);
    await report.getByRole("button", { name: "Close" }).click();
    await expect(page.getByRole("heading", { name: `Month ${String(month + 1)}`, exact: true })).toBeVisible();
    // The first click after the sheet closes must land.
    await page.getByRole("button", { name: "Same again" }).click();
    await expect(page.getByText(/^[1-9] of \d free slots planned$/)).toBeVisible();
    const remove = page.getByRole("button", { name: /^Take out/ });
    while ((await remove.count()) > 0) await remove.first().click();
    await expectNothingBroken(page, `in month ${String(month + 1)}`);
  }
});

test("a life from sixteen is played card by card to the first month", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Live this life: A life from sixteen" }).click();

  const prologue = page.locator("[data-prologue]");
  await expect(prologue).toBeVisible();
  const handover = page.locator("[data-prologue-handover]");
  for (let card = 0; card < 40 && !(await handover.isVisible()); card += 1) {
    await expectNothingBroken(page, `on prologue card ${String(card)}`);
    const v = await prologue.getAttribute("data-v");
    await page.locator("[data-prologue-card] [data-answer] button:enabled").first().click();
    await expect(page.locator(`[data-prologue][data-v="${v ?? ""}"]`)).toHaveCount(0);
  }

  await expect(handover).toBeVisible();
  await expectNothingBroken(page, "at the handover");
  await page.getByRole("button", { name: "Start month 1" }).click();
  await expect(page.getByRole("heading", { name: "Month 1", exact: true })).toBeVisible();
  await expectNothingBroken(page, "in the first month");
});

/** Ada's recorded life up to the flight: the client loads it as a save through the local authority. */
function adaBeforeFlight(): string {
  const save = lifeSaves["ada-careful"];
  if (save === undefined) throw new Error("No recorded life ada-careful.");
  return JSON.stringify({ save: { ...save, commands: save.commands.slice(0, -1) }, clock: { anchor: 0 } });
}

/** On a phone a panel is behind its tab; on a desktop every panel shows and the tab bar is hidden. */
async function openTab(page: Page, name: string): Promise<void> {
  const tabs = page.getByRole("navigation", { name: "Sections" });
  if (await tabs.isVisible()) await tabs.getByRole("button", { name }).click();
}

/** Ada's save goes in once per tab, so a reload keeps what was played since. */
async function seedAda(page: Page): Promise<void> {
  await page.addInitScript((stored) => {
    if (sessionStorage.getItem("seeded") === null) {
      localStorage.setItem("japacity.save", stored);
      sessionStorage.setItem("seeded", "1");
    }
  }, adaBeforeFlight());
  await page.goto("/");
}

async function boardThePlane(page: Page): Promise<void> {
  await openTab(page, "Japa");
  await page.getByRole("button", { name: "Board the plane" }).click();
  const moment = page.getByRole("dialog");
  await expect(moment).toBeVisible();
  await expect(moment.getByRole("heading", { name: /fly out/i })).toBeVisible();
  await expectNothingBroken(page, "on the flight");
  await moment.getByRole("button", { name: "Carry on" }).click();
  // R-CHAPTER-006: the send-off card follows the flight's moment.
  await closeSendOff(page);
}

/**
 * The months abroad to play before the December visit opens: it opens as a
 * December month ends, and the world, not the recorded seed, says which month that is.
 */
function monthsToDecember(): number {
  const save = lifeSaves["ada-careful"];
  if (save === undefined) throw new Error("No recorded life ada-careful.");
  const flight = save.commands[save.commands.length - 1]?.tick ?? 0;
  for (let tick = flight; tick < flight + 12; tick += 1) {
    if (standInWorld(save.worldSeed, tick, content).vars["var.season-december"] === 1) return tick - flight + 1;
  }
  throw new Error("No December in the year after the flight.");
}

/** Ends the month, steps through any staged moments, reads the report and closes it. */
async function endMonthAndRead(page: Page, when: string): Promise<void> {
  await openTab(page, "Month");
  await page.getByRole("button", { name: "End month" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const carryOn = page.getByRole("button", { name: /^(Carry on|Next)$/ });
  for (let shown = 0; shown < 5 && (await carryOn.isVisible()); shown += 1) await carryOn.click();
  const report = page.getByRole("dialog");
  await expect(report.getByRole("heading", { name: /^Month \d+$/ })).toBeVisible();
  await expectNothingBroken(page, when);
  await report.getByRole("button", { name: "Close" }).click();
}

/** The send-off card opens once the report is closed; it is closed in turn. */
async function closeSendOff(page: Page): Promise<void> {
  const card = page.locator("[data-share-card='send-off']");
  await expect(card).toBeVisible();
  await expect(card.getByText("Japacity is a game.")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

test("a recorded life boards the plane, the flight gets the whole screen, and life abroad has its own tabs", async ({ page }) => {
  await seedAda(page);
  await boardThePlane(page);

  const tabs = page.getByRole("navigation", { name: "Sections" });
  if (await tabs.isVisible()) {
    await expect(tabs.getByRole("button")).toHaveText(["Month", "You", "Money", "Status", "People", "Home"]);
  }
  await openTab(page, "Status");
  await expect(page.getByRole("heading", { name: "Status", exact: true })).toBeVisible();
  await openTab(page, "Home");
  await expect(page.getByRole("heading", { name: "The way home" })).toBeVisible();
  await expectNothingBroken(page, "on landing");

  // The life abroad survives a reload, and the card due this month comes back with it.
  await page.reload();
  await closeSendOff(page);
  await openTab(page, "Home");
  await expect(page.getByRole("heading", { name: "The way home" })).toBeVisible();

  // A month abroad and its report; the card had its month and does not come back, after a reload either.
  await endMonthAndRead(page, "in the first report abroad");
  await expect(page.locator("[data-share-card]")).toHaveCount(0);
  await page.reload();
  await openTab(page, "Home");
  await expect(page.getByRole("heading", { name: "The way home" })).toBeVisible();
  await expect(page.locator("[data-share-card]")).toHaveCount(0);
});

test("a life abroad answers the December visit, changes money and comes home", async ({ page }) => {
  await seedAda(page);
  await boardThePlane(page);

  // December: the visit takes the whole screen once the report is closed.
  const months = monthsToDecember();
  for (let month = 1; month < months; month += 1) await endMonthAndRead(page, `in report ${String(month)} abroad`);
  await endMonthAndRead(page, "in the December report");
  const scene = page.getByRole("dialog");
  await expect(scene.locator("[data-scene='setpiece.december']")).toBeVisible();
  await expectNothingBroken(page, "in the December visit");
  const go = scene.locator("[data-answer='go']");
  await expect(go.getByRole("button")).toBeDisabled();
  await expect(go.getByText(/You cannot do that now/)).toBeVisible();
  await scene.locator("[data-answer='stay']").getByRole("button").click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("[data-december-tile]")).toHaveCount(0);

  // Dollars into naira at the bank, so the fare home can be bought.
  await openTab(page, "Money");
  await page.getByRole("button", { name: "Change money" }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByLabel("From").selectOption({ label: "Dollars" });
  await sheet.getByLabel("To").selectOption({ label: "Naira" });
  await sheet.getByLabel("Amount").fill("5000");
  await sheet.getByRole("button", { name: "Do it" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // Home, by choice.
  await openTab(page, "Home");
  await expect(page.getByText("Today you would come home by choice.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Go home", exact: true }).click();
  await page.getByRole("button", { name: "Yes, go" }).click();
  const carryOn = page.getByRole("button", { name: /^(Carry on|Next)$/ });
  for (let shown = 0; shown < 5 && (await carryOn.isVisible()); shown += 1) await carryOn.click();

  const tabs = page.getByRole("navigation", { name: "Sections" });
  if (await tabs.isVisible()) await expect(tabs.getByRole("button")).toHaveText(["Month", "You", "Money", "Japa", "People", "News"]);
  await openTab(page, "You");
  await expect(page.getByRole("list", { name: "Times you came home" })).toContainText("by choice");
  await expectNothingBroken(page, "back home");
});

/** The header's japacity figure: its face and size as the browser draws it. */
async function headerFigure(page: Page): Promise<{ family: string; size: number }> {
  const figure = page.locator("header [data-japacity-figure]");
  await expect(figure).toBeVisible();
  return figure.evaluate((element) => {
    const style = getComputedStyle(element);
    return { family: style.fontFamily, size: Number.parseFloat(style.fontSize) };
  });
}

test.describe("the header on a 390 px phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the japacity figure is set in the body face, large enough to read, and the game's name is not said twice", async ({ page }) => {
    await seedAda(page);
    const { family, size } = await headerFigure(page);
    expect(family).not.toMatch(/Danfo/);
    expect(size).toBeGreaterThanOrEqual(18);
    // The game's name stays for screen readers but takes no room beside the japacity label.
    const name = await page.locator("header h1").boundingBox();
    expect(name?.width ?? 0).toBeLessThanOrEqual(1);
  });
});

test.describe("the header on a desktop", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("the japacity figure keeps the display face, larger", async ({ page }) => {
    await seedAda(page);
    const { family, size } = await headerFigure(page);
    expect(family).toMatch(/Danfo/);
    expect(size).toBeGreaterThanOrEqual(24);
  });
});

test.describe("the side job on a 390 px phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("a side job's words keep the card's width, with the quit button under them", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /^Live this life/ }).first().click();
    await expect(page.getByRole("heading", { name: "Month 1", exact: true })).toBeVisible();

    const side = page.locator("[data-side-job]");
    for (let month = 0; month < 12 && !(await side.isVisible()); month += 1) {
      await openTab(page, "Month");
      const accept = page.getByRole("button", { name: /^Accept/ });
      if (await accept.isVisible()) {
        await accept.click();
        continue;
      }
      const hunt = page.locator("li", { has: page.getByRole("heading", { name: "Look for a job", exact: true }) });
      await hunt.getByLabel("Which one").selectOption({ label: "Weekend tutoring" });
      await page.getByRole("button", { name: "Add to month: Look for a job" }).click();
      await endMonthAndRead(page, `while looking for a side job, month ${String(month + 1)}`);
    }

    await expect(side).toBeVisible();
    const words = await side.locator("[data-side-words]").boundingBox();
    const quit = await side.getByRole("button", { name: "Quit the side job" }).boundingBox();
    const card = await side.boundingBox();
    expect(words !== null && quit !== null && card !== null).toBe(true);
    if (words === null || quit === null || card === null) return;
    expect(quit.y).toBeGreaterThanOrEqual(words.y + words.height);
    expect(words.width).toBeGreaterThan(card.width * 0.8);
  });
});
