import type { Game } from "@japacity/sim/testing";
import { start } from "@japacity/sim/testing";

import { expect, test, type Page } from "@playwright/test";

// Lives with people in them are played by the simulation's own test handle and handed to the client as a save, so the
// local authority replays them. The people live in the world (docs/rules/world.md R-WORLD-020): met in a place, their
// threads and the slots in the phone's Chats, a visit at their room, the interview as the ask under the band.
import { content } from "../../../packages/content/src/index";
import { SOFTWARE_WEBGL } from "./support/browser";
import { doAct, intoTheRoom, LIVED, openApp, passCards, passHomeTeach, placeReady, putPhoneAway, seedSave, sleepTheMonth, bedThing } from "./support/live";
import { shootAtSize } from "./support/preview";
import { kept } from "./support/saves";

test.use({ launchOptions: SOFTWARE_WEBGL });

const TOBI = "person.tobi-bank";
const SEE = { activity: "activity.see-someone", param: null } as const;
const PAIR = "pair-1";

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

/** The life handed to the client and opened in the world, past any card over it, its place drawn. */
async function seed(page: Page, game: Game): Promise<void> {
  if (game.state.turn.banked === 0) game.grant(1);
  await seedSave(page, kept(game.save));
  await page.goto(`/${LIVED}`);
  await expect(page.locator("[data-band]")).toBeVisible({ timeout: 30_000 });
  await passCards(page);
  await placeReady(page);
  await passHomeTeach(page, 2000);
}

/** Chats on the phone, on a row: the people's slots, or a bond's thread. */
async function openChat(page: Page, row: string) {
  const chats = await openApp(page, "chats");
  await chats.locator(`[data-chat-row="${row}"]`).click();
  return chats;
}

/** The bond's thread in Chats: the row that names the person. */
async function openBond(page: Page, name: string) {
  const chats = await openApp(page, "chats");
  await chats.locator("[data-chat-row]", { hasText: name }).click();
  const head = chats.locator("[data-bond-head]");
  await expect(head).toBeVisible();
  return head;
}

test("[R-WORLD-020] the slots in Chats show the family, and a computer partner courted in the parlour is said to live in the game", async ({ page }, info) => {
  test.setTimeout(120_000);
  const game = tunde();
  month(game);
  await seed(page, game);
  const slots = await openChat(page, "people");
  const people = slots.locator("[data-people-slots]");
  await expect(people.locator('[data-slot="partner"]')).toContainText("Nobody yet");
  await expect(people.locator("[data-slot]")).toHaveCount(Object.keys(game.state.people.slots).length);
  await expectNothingBroken(page, "in the slots");
  await shootAtSize(page, "tab", info.project.name);
  await putPhoneAway(page);

  // Tobi in the parlour: talking to him opens his card, whose one button courts him (R-PEOPLE-013).
  await intoTheRoom(page);
  const tobi = (await page.locator('[data-mark][aria-label="Tobi"]').getAttribute("data-mark")) ?? "";
  await doAct(page, tobi, "talk");
  await page.getByRole("dialog").getByRole("button", { name: "Start seeing Tobi" }).click();
  await expect(page.locator("[data-corner]")).toContainText("Tobi is a computer character. They live in the game.", { timeout: 15_000 });
  const head = await openBond(page, "Tobi");
  await expect(head.locator('[data-head-row="stage"]')).toContainText("Seeing each other");
  await expect(page.locator("[data-app-screen='chats'] h3 [data-person-mark='computer']")).toBeVisible();
});

test("[R-WORLD-020] a bond carries its time together, and a visit at their room counts with it", async ({ page }, info) => {
  test.setTimeout(180_000);
  const game = tunde();
  game.accept({ type: "people/court", with: TOBI });
  for (let index = 0; index < 3; index += 1) month(game, [SEE]);
  await seed(page, game);
  await expect((await openBond(page, "Tobi")).locator('[data-head-row="stage"]')).toContainText("Three times together");
  await putPhoneAway(page);

  // Seeing someone answers at once (R-ACTIVITY-015): the visit at their room makes the moment now, in the month in hand.
  await page.locator('[data-thumb="map"]').click();
  await page.waitForFunction(() => (window as unknown as { __map?: { ready?: boolean } }).__map?.ready === true, null, { timeout: 60_000 });
  await page.evaluate(() => document.querySelector<HTMLButtonElement>('[data-stop="place.their-room"]')?.click());
  await page.locator('[data-ride-sheet="place.their-room"] [data-ride-main]').click();
  await page.waitForFunction(() => {
    const city = (window as unknown as { __city?: { ready?: boolean; place?: string } }).__city;
    return city?.place === "place.their-room" && city.ready === true;
  }, null, { timeout: 90_000 });
  await passCards(page);
  await doAct(page, "time-together", "together");
  const asked = page.getByRole("dialog").getByRole("button", { name: /^See someone/ });
  if (await asked.last().waitFor({ state: "visible", timeout: 4000 }).then(() => true, () => false)) await asked.last().click();
  // The visit's answer, told on its card (R-WORLD-008), is put away with Done.
  const answer = page.getByRole("dialog", { name: "See someone" });
  await expect(answer).toContainText("You met up.");
  await answer.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 15_000 });

  const head = await openBond(page, "Tobi");
  await expect(head.locator('[data-head-row="stage"]')).toContainText("Four times together");
  await expectNothingBroken(page, "on a bond");
  await shootAtSize(page, "bond", info.project.name);

  const end = head.locator('[data-head-row="end"]');
  await end.locator("summary").click();
  await expect(end).toContainText("Ending it costs you standing at home and some of your wellbeing.");
});

test("[R-WORLD-020] a friend's proposal waits for an answer in their thread, and yes makes them partners", async ({ page }, info) => {
  test.setTimeout(120_000);
  const game = tunde();
  month(game);
  linkFriend(game);
  game.accept({ type: "people/court", with: PAIR });
  game.accept({ type: "people/proposal", pair: PAIR, proposal: { step: "partner", route: null, lead: null } }, "authority");
  await seed(page, game);

  const chats = await openApp(page, "chats");
  await chats.locator("[data-chat-row]").last().click();
  const head = chats.locator("[data-bond-head]");
  const pending = head.locator('[data-head-row="pending"]');
  await expect(pending).toContainText("They ask to be together.");
  await expectNothingBroken(page, "on a proposal");
  await shootAtSize(page, "proposal", info.project.name);
  await pending.getByRole("button", { name: "Say yes" }).click();
  await expect(head).not.toContainText("They ask to be together.");
});

test("[R-WORLD-006] [R-INTERVIEW-004] the interview asks one question at a time and holds the month until the last answer", async ({ page }, info) => {
  test.setTimeout(150_000);
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

  // The bed will not turn the month while the interview waits (R-INTERVIEW-004): Sleep is refused and nothing turns.
  await intoTheRoom(page);
  const age = (await page.locator("[data-band]").textContent())?.match(/\d+ yrs \d+ mo/)?.[0] ?? "";
  await doAct(page, await bedThing(page), "end-month");
  await page.locator("[data-night-teach-ok]").click({ timeout: 2000 }).catch(() => undefined);
  await expect(page.locator("[data-asleep]")).toHaveCount(0);
  await page.waitForTimeout(3000);
  await expect(page.locator("[data-world-sheet='results']")).toHaveCount(0);
  await expect(page.locator("[data-band]")).toContainText(age);
  await passCards(page);
  await page.keyboard.press("Escape");

  // The ask's line under the band opens the interview, one question at a time (R-WORLD-006).
  await page.locator("[data-nudge-open]").click();
  const interview = page.getByRole("region", { name: "The relationship interview" });
  await expect(interview).toBeVisible();
  await expect(interview).toContainText("Question 1 of 3");
  await expectNothingBroken(page, "in the interview");
  await shootAtSize(page, "interview", info.project.name);

  await interview.getByRole("button", { name: "Four to eight times" }).click();
  await interview.getByRole("button", { name: "A town back home" }).click();
  await interview.getByRole("button", { name: "In the UK" }).click();
  // The last answer sends the interview off the asks (R-WORLD-006), and the bed turns the month again.
  await expect(interview).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const results = await sleepTheMonth(page);
  await expect(results.getByRole("heading", { name: "The month is done" })).toBeVisible();
});
