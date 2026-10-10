import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

// Lives with people in them are played by the simulation's own test handle and
// handed to the client as a save, so the local authority replays them.
import { content } from "../../../packages/content/src/index";
import type { Game } from "../../../packages/sim/src/testing/play";
import { start } from "../../../packages/sim/src/testing/play";

const TOBI = "person.tobi-bank";
const SEE = { activity: "activity.see-someone", param: null } as const;
const PAIR = "pair-1";

/** Where the pictures for the build notes go, when asked for. */
const PREVIEW = process.env.PREVIEW_DIR;

/** Text that must never reach the player, as the smoke spec holds it. */
const BROKEN: readonly [string, RegExp][] = [
  ["a raw object", /\[object Object\]/],
  ["a missing value", /\bundefined\b|\bNaN\b/],
  ["a words key with no words", /\b(?:line|ui|reject)\.[a-z-]+\.[a-z-]+/],
  ["a raw people id", /\b(?:person|phrase|people)\.[a-z]+-[a-z-]+/],
];

async function expectNothingBroken(page: Page, when: string): Promise<void> {
  const shown = await page.evaluate(() => document.body.textContent);
  for (const [what, pattern] of BROKEN) expect(shown.match(pattern)?.[0], `${what} on screen ${when}`).toBeUndefined();
}

async function shoot(page: Page, name: string, project: string): Promise<void> {
  if (PREVIEW === undefined || PREVIEW === "") return;
  const size = project.startsWith("Pixel") ? "phone" : "desktop";
  await page.screenshot({ path: join(PREVIEW, `${name}-${size}.png`), fullPage: false });
}

function tunde(): Game {
  return start({ scenario: "scenario.tunde", content });
}

function month(game: Game, slots: { activity: string; param: null }[] = []): void {
  if (game.state.turn.banked === 0) game.grant(1);
  game.endTurn(slots as Parameters<Game["endTurn"]>[0]);
}

function linkFriend(game: Game): void {
  game.accept({ type: "people/invite", slot: "partner", looking: "partner", fill: "already-in-uk" });
  game.accept(
    {
      type: "people/link",
      slot: "partner",
      pair: PAIR,
      facts: {
        label: "player",
        ageMonths: 340,
        where: "abroad",
        country: "country.uk",
        status: "status.uk-settled",
        statusMonthsLeft: null,
        monthsInCountry: 30,
        job: "activity.job-uk-senior-care",
        meetsFloor: { "route.uk-partner": true },
        eduLevel: 3,
        englishBand: 70,
        home: "town",
        joint: null,
        funds: null,
        assistanceTaken: 0,
        sponsorReady: "route.uk-partner",
      },
    },
    "authority",
  );
}

async function seed(page: Page, game: Game): Promise<void> {
  if (game.state.turn.banked === 0) game.grant(1);
  await page.addInitScript((stored) => {
    if (sessionStorage.getItem("seeded") === null) {
      localStorage.setItem("japacity.save", stored);
      sessionStorage.setItem("seeded", "1");
    }
  }, JSON.stringify({ save: game.save, clock: { anchor: 0 } }));
  await page.goto("/?classic");
  await expect(page.getByRole("heading", { name: /^Month \d+$/ }).first()).toBeVisible();
}

/** On a phone a panel is behind its tab; on a desktop every panel shows and the tab bar is hidden. */
async function openTab(page: Page, name: string): Promise<void> {
  const tabs = page.getByRole("navigation", { name: "Sections" });
  // The bar is there once the shell has drawn; right after a reload it is not yet, and its absence would read as a desktop.
  await page.getByRole("banner").waitFor();
  if (await tabs.isVisible()) await tabs.getByRole("button", { name }).click();
}

test("the people tab shows the family, and a computer partner chosen is said to live in the game", async ({ page }, info) => {
  const game = tunde();
  month(game);
  await seed(page, game);
  await openTab(page, "People");
  const people = page.locator('[data-tab="people"]');
  await expect(people.getByRole("heading", { name: "Your people" })).toBeVisible();
  await expect(people.locator('[data-slot="partner"]')).toContainText("Nobody yet");
  await expect(people.locator("[data-slot]")).toHaveCount(Object.keys(game.state.people.slots).length);
  await people.getByRole("heading", { name: "Your people" }).scrollIntoViewIfNeeded();
  await expectNothingBroken(page, "on the people tab");
  await shoot(page, "tab", info.project.name);

  await people.getByRole("button", { name: "Start seeing Tobi" }).click();
  await expect(people.getByText("Tobi is a computer character. They live in the game.")).toBeVisible();
  await expect(people.locator("[data-bond]").first()).toContainText("Seeing each other");
});

test("a bond carries its time together, and time planned with someone names them", async ({ page }, info) => {
  const game = tunde();
  game.accept({ type: "people/court", with: TOBI });
  for (let index = 0; index < 3; index += 1) month(game, [SEE]);
  await seed(page, game);

  await openTab(page, "Month");
  await page.getByRole("button", { name: "Add to month: See someone" }).click();
  await expect(page.getByRole("list", { name: "This month" })).toContainText("See someone with Tobi");

  await openTab(page, "People");
  const bond = page.locator("[data-bond]").first();
  await bond.scrollIntoViewIfNeeded();
  await expect(bond).toContainText("Tobi");
  await expect(bond).toContainText("3 moments so far");
  await expectNothingBroken(page, "on a bond");
  await shoot(page, "bond", info.project.name);

  await bond.getByRole("button", { name: "End it" }).click();
  await expect(bond).toContainText("Ending it costs you standing at home and some of your wellbeing.");
});

test("a friend's proposal waits for an answer, and yes makes them partners", async ({ page }, info) => {
  const game = tunde();
  month(game);
  linkFriend(game);
  game.accept({ type: "people/court", with: PAIR });
  game.accept({ type: "people/proposal", pair: PAIR, proposal: { step: "partner", route: null, lead: null } }, "authority");
  await seed(page, game);

  await openTab(page, "People");
  const bond = page.locator("[data-bond]").first();
  await bond.scrollIntoViewIfNeeded();
  await expect(bond).toContainText("They ask to be together.");
  await expectNothingBroken(page, "on a proposal");
  await shoot(page, "proposal", info.project.name);
  await bond.getByRole("button", { name: "Say yes" }).click();
  await expect(bond).not.toContainText("They ask to be together.");
});

test("the interview asks one question at a time and holds the month until the last answer", async ({ page }, info) => {
  const game = tunde();
  month(game);
  linkFriend(game);
  game.accept(
    {
      type: "interview/open",
      pair: PAIR,
      route: "route.uk-partner",
      questions: [
        { id: "times-met", options: ["not-yet", "one-to-three", "four-to-eight", "nine-to-fifteen"] },
        { id: "partner-home", options: ["city", "town", "not-sure"] },
        { id: "plans", options: ["uk", "canada", "with-you-abroad", "home", "not-decided"] },
      ],
    },
    "authority",
  );
  await seed(page, game);

  const interview = page.getByRole("region", { name: "The relationship interview" });
  await expect(interview).toBeVisible();
  await expect(interview).toContainText("Question 1 of 3");
  await expect(page.getByRole("button", { name: "Turn the page" })).toBeDisabled();
  await interview.scrollIntoViewIfNeeded();
  await expectNothingBroken(page, "in the interview");
  await shoot(page, "interview", info.project.name);

  await interview.getByRole("button", { name: "Four to eight times" }).click();
  await interview.getByRole("button", { name: "A town back home" }).click();
  await interview.getByRole("button", { name: "In the UK" }).click();
  await expect(interview).toContainText("Your answers are in.");
  await expect(page.getByRole("button", { name: "Turn the page" })).toBeEnabled();
});
