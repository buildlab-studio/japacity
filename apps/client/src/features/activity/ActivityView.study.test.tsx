// Learning tech on the act's card, before the tap (quality:skill-bands-slow-gains, activity:study-days-capped, activity:paid-tech-courses,
// activity:bootcamp-paid-after-a-job): the gain at the band the character is in as a tag, a course's months and its bill as chips and
// what it ends with as tags (text:show-then-tell), and why a study waits.
import type { Id } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { newGame } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { courseParts, studyGainNow, studyPaysWords } from "../../shared/words/study";
import { say } from "../../shared/words/text";
import { ActivityPicker } from "./ActivityView";

const CLASS: Id<"activity"> = "activity.learn-tech";
const FREE: Id<"activity"> = "activity.learn-free";
const COURSE: Id<"activity"> = "activity.online-course";
const DIPLOMA: Id<"activity"> = "activity.tech-diploma";
const BOOTCAMP: Id<"activity"> = "activity.bootcamp";

const card = (id: string) => document.querySelector(`[data-act-card="${id}"]`);

describe("a study's card", () => {
  test("[quality:skill-bands-slow-gains] [activity:paid-tech-courses] [text:show-then-tell] given the graduate at the hub's desk, when the study rows show, then each says what it gives a month at this level as a gain's tag, a course its months as a chip and what it ends with as tags", async () => {
    const view = newGame("scenario.graduate").view();
    await renderWithView(<ActivityPicker only={[FREE, COURSE]} />, view);
    const gain = (id: string) => {
      const now = studyGainNow(view, id);
      return now === null || now.taught ? null : now.words;
    };
    const ups = (id: string) => [...(card(id)?.querySelectorAll('[data-change="up"]') ?? [])].map((tag) => tag.textContent);
    expect(gain(FREE)).not.toBeNull();
    expect(ups(FREE)[0]).toBe(gain(FREE));
    expect(ups(COURSE)[0]).toBe(gain(COURSE));
    const course = courseParts(COURSE);
    expect(card(COURSE)?.querySelector('[data-fact="time"]')?.textContent).toBe(course?.months);
    expect(ups(COURSE).slice(1)).toEqual(course?.gains.slice(0, 1));
    expect(card(COURSE)?.textContent).not.toMatch(/It ends with/);
  });

  test("[activity:paid-tech-courses] [activity:bootcamp-paid-after-a-job] [text:show-then-tell] given the diploma and the bootcamp, when their rows show, then each says what it costs though nothing is paid now, as a bill's chip", async () => {
    await renderWithView(<ActivityPicker only={[DIPLOMA, BOOTCAMP]} />, newGame("scenario.graduate").view());
    expect(card(DIPLOMA)?.querySelector('[data-fact="bill"]')?.textContent).toBe(studyPaysWords(DIPLOMA));
    expect(card(BOOTCAMP)?.querySelector('[data-fact="bill"]')?.textContent).toBe(studyPaysWords(BOOTCAMP));
    expect(studyPaysWords(DIPLOMA)).not.toMatch(/\.$/);
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
