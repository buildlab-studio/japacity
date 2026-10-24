// Learning tech on the act's card, before the tap (quality:skill-bands-slow-gains, activity:study-days-capped, activity:paid-tech-courses,
// activity:bootcamp-paid-after-a-job): the gain at the band the character is in, a course's months, end and cost, and why a study waits.
import type { Id } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { newGame } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { courseWords, studyDoesWords, studyPaysWords } from "../../shared/words/study";
import { say } from "../../shared/words/text";
import { ActivityPicker } from "./ActivityView";

const CLASS: Id<"activity"> = "activity.learn-tech";
const FREE: Id<"activity"> = "activity.learn-free";
const COURSE: Id<"activity"> = "activity.online-course";
const DIPLOMA: Id<"activity"> = "activity.tech-diploma";
const BOOTCAMP: Id<"activity"> = "activity.bootcamp";

const card = (id: string) => document.querySelector(`[data-act-card="${id}"]`);

describe("a study's card", () => {
  test("[quality:skill-bands-slow-gains] [activity:paid-tech-courses] given the graduate at the hub's desk, when the study cards show, then each says what it gives a month at this level, its months and what it ends with", async () => {
    const view = newGame("scenario.graduate").view();
    await renderWithView(<ActivityPicker only={[FREE, COURSE]} />, view);
    expect(card(FREE)?.querySelector("[data-does]")?.textContent).toBe(studyDoesWords(view, FREE));
    expect(card(COURSE)?.querySelector("[data-does]")?.textContent).toBe(studyDoesWords(view, COURSE));
    expect(card(COURSE)?.querySelector("[data-course]")?.textContent).toBe(courseWords(COURSE));
  });

  test("[activity:paid-tech-courses] [activity:bootcamp-paid-after-a-job] given the diploma and the bootcamp, when their cards show, then each says what it costs though nothing is paid now", async () => {
    await renderWithView(<ActivityPicker only={[DIPLOMA, BOOTCAMP]} />, newGame("scenario.graduate").view());
    expect(card(DIPLOMA)?.querySelector("[data-course-pays]")?.textContent).toBe(studyPaysWords(DIPLOMA));
    expect(card(BOOTCAMP)?.querySelector("[data-course-pays]")?.textContent).toBe(studyPaysWords(BOOTCAMP));
  });

  test("[activity:study-days-capped] given three days of class taken this month, when the class's card shows, then it says the month's days are taken, never that there is nothing to pick", async () => {
    const game = newGame("scenario.graduate");
    for (let day = 0; day < 3; day += 1) game.accept({ type: "activity/now", activity: CLASS, param: null });
    const option = game.view().activities.find((each) => each.id === CLASS);
    expect(option?.capped).toBe(true);
    await renderWithView(<ActivityPicker only={[CLASS]} />, game.view());
    expect(card(CLASS)?.textContent).toContain(say("ui.act.capped"));
    expect(card(CLASS)?.textContent).not.toContain(say("ui.needs.nothing-to-pick"));
  });

  test("[activity:paid-tech-courses] given a study path held, when another study's card shows, then it says one study at a time", async () => {
    const view = newGame("scenario.graduate").view();
    const activities = view.activities.map((option) => (option.id === FREE ? { ...option, allowed: false, missing: [], onCourse: true as const } : option));
    await renderWithView(<ActivityPicker only={[FREE]} />, { ...view, activities });
    expect(card(FREE)?.textContent).toContain(say("ui.act.on-course"));
  });
});
