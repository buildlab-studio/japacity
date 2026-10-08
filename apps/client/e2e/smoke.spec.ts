import { expect, test, type Page } from "@playwright/test";

// The recorded lives are the simulation's own data, replayed here through the client's save.
import { lifeSaves } from "../../../packages/sim/src/goldens/lives.data";

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

test("a recorded life boards the plane, the flight gets the whole screen, and life abroad has its own tabs", async ({ page }) => {
  await page.addInitScript((stored) => {
    if (sessionStorage.getItem("seeded") === null) {
      localStorage.setItem("japacity.save", stored);
      sessionStorage.setItem("seeded", "1");
    }
  }, adaBeforeFlight());
  await page.goto("/");

  await openTab(page, "Japa");
  await page.getByRole("button", { name: "Board the plane" }).click();

  const moment = page.getByRole("dialog");
  await expect(moment).toBeVisible();
  await expect(moment.getByRole("heading", { name: /fly out/i })).toBeVisible();
  await expectNothingBroken(page, "on the flight");
  await moment.getByRole("button", { name: "Carry on" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  const tabs = page.getByRole("navigation", { name: "Sections" });
  if (await tabs.isVisible()) {
    await expect(tabs.getByRole("button")).toHaveText(["Month", "You", "Money", "Status", "Home"]);
  }
  await openTab(page, "Status");
  await expect(page.getByRole("heading", { name: "Status", exact: true })).toBeVisible();
  await openTab(page, "Home");
  await expect(page.getByRole("heading", { name: "The way home" })).toBeVisible();
  await expectNothingBroken(page, "on landing");

  // A month abroad, and its report.
  await openTab(page, "Month");
  await page.getByRole("button", { name: "End month" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const carryOn = page.getByRole("button", { name: /^(Carry on|Next)$/ });
  for (let shown = 0; shown < 5 && (await carryOn.isVisible()); shown += 1) await carryOn.click();
  const report = page.getByRole("dialog");
  await expect(report.getByRole("heading", { name: /^Month \d+$/ })).toBeVisible();
  await expectNothingBroken(page, "in the first report abroad");
  await report.getByRole("button", { name: "Close" }).click();

  // The life abroad survives a reload.
  await page.reload();
  await openTab(page, "Home");
  await expect(page.getByRole("heading", { name: "The way home" })).toBeVisible();
});
