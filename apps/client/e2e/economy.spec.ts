// The economy in a real browser at phone size (activity:naira-pay-reviewed-yearly, activity:study-days-capped): the nurse's Jobs app says the
// pay review is next month, and the month's results tell the review in one line; a graduate who has had three days of class this month
// finds the day's class at the home table saying so, in place of its button. Each life is built on the real content and handed to the
// page as a save, so neither waits on the recorded lives.
import { expect } from "@playwright/test";
import { answerFirst, type Game, start } from "@japacity/sim/testing";

import { content, text } from "../../../packages/content/src/index";
import { SOFTWARE_WEBGL } from "./support/browser";
import { passOpeningWords } from "./support/door";
import { doAct, LIVED, openApp, passHomeTeach, placeReady, putPhoneAway, seedSave, sleepTheMonth } from "./support/live";
import { test } from "./support/policy";
import { shoot } from "./support/preview";
import { kept } from "./support/saves";

test.use({ viewport: { width: 390, height: 844 }, launchOptions: SOFTWARE_WEBGL });

function phoneOnly(project: string): void {
  test.skip(project !== "Pixel 7", "The economy's screens are checked at phone size.");
}

/** One month of rest, any open question answered first, with a turn granted when none is banked. */
function rest(game: Game): void {
  answerFirst(game);
  if (game.state.turn.banked < 1) game.grant(1);
  game.endTurn();
}

/** The nurse played month by month until her pay review is the next month's. */
function nurseBeforeReview(): string {
  const game = start({ scenario: "scenario.nurse", content });
  for (let month = 0; month < 15 && game.view().job.review !== 1; month += 1) rest(game);
  if (game.view().job.review !== 1) throw new Error("The nurse's review never came a month away.");
  answerFirst(game);
  return kept(game.save);
}

/** The graduate at home with this month's three days of class taken. */
function graduateClassCapped(): string {
  const game = start({ scenario: "scenario.graduate", content });
  for (let day = 0; day < content.tuning.turn.studyDaysCap; day += 1) game.accept({ type: "activity/now", activity: "activity.learn-tech", param: null });
  if (game.view().activities.find((option) => option.id === "activity.learn-tech")?.capped !== true) throw new Error("The class is not capped.");
  return kept(game.save);
}

test("[activity:naira-pay-reviewed-yearly] the nurse's Jobs app says her pay review is next month, and the month's results tell the new pay", async ({ page }, info) => {
  phoneOnly(info.project.name);
  test.setTimeout(180_000);
  await seedSave(page, nurseBeforeReview());
  await page.goto(`/${LIVED}`);
  await passOpeningWords(page);
  await placeReady(page);
  await passHomeTeach(page);
  const jobs = await openApp(page, "jobs");
  // text:show-then-tell: the next pay review is the held job's when chip.
  await expect(jobs.locator('[data-job-row] [data-fact="when"]')).toHaveText(text["phone.jobs.review.one"] ?? "phone.jobs.review.one");
  await shoot(page, "economy-jobs-review-phone");
  await putPhoneAway(page);
  const results = await sleepTheMonth(page);
  await expect(results).toContainText((text["line.activity.reviewed"] ?? "").split(":")[0] ?? "");
  await shoot(page, "economy-results-review-phone");
});

test("[activity:study-days-capped] with three days of class taken this month, the home table's card for the day's class says so where its button was", async ({ page }, info) => {
  phoneOnly(info.project.name);
  test.setTimeout(150_000);
  await seedSave(page, graduateClassCapped());
  await page.goto(`/${LIVED}`);
  await passOpeningWords(page);
  await placeReady(page);
  await passHomeTeach(page);
  await doAct(page, "table", "study");
  const card = page.locator('[data-act-card="activity.learn-tech"]');
  await expect(card).toBeVisible({ timeout: 20_000 });
  await expect(card).toContainText(text["ui.act.capped"] ?? "ui.act.capped");
  await shoot(page, "economy-class-capped-phone");
});
