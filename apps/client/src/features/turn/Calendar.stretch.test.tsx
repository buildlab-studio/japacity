// The Calendar says when the plan stretches the character (world:month-passes-as-lived): a
// job with a commitment and a side job, or a job with two commitments beside it; one line, no figure.
import { content } from "@japacity/content";
import type { Id, PlayerView } from "@japacity/sim";
import { applyEffects } from "@japacity/sim/testing";
import { act } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { newGame } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { say } from "../../shared/words/text";
import { Calendar } from "./Calendar";
import { isMonthAct } from "../../shared/days/days";
import { restores, stretchedWords } from "../../shared/days/stretch";

const TEACHER = "activity.job-teacher" as Id<"activity">;
const TUTORING = "activity.weekend-tutoring" as Id<"activity">;
// Decision 0012 (activity:acts-may-repeat-in-month): the coding class and the portfolio answer at once and carry nothing on, so the
// commitments that stretch the day are a master's at home and open source.
const COURSE = "activity.masters-at-home" as Id<"activity">;
const PORTFOLIO = "activity.open-source" as Id<"activity">;
const CLASS = "activity.learn-tech" as Id<"activity">;
const PROJECT = "activity.build-portfolio" as Id<"activity">;
const REST = "activity.rest" as Id<"activity">;

/** Ada with the jobs named held, through the activity kind's own effect. */
function graduateWorking(jobs: Id<"activity">[]): PlayerView {
  const game = newGame("scenario.graduate");
  applyEffects(
    game,
    jobs.map((job) => ({ type: "activity/start-job", job })),
  );
  return game.view();
}

function stretchedLine(): string | null {
  return document.querySelector("[data-month-stretched]")?.textContent ?? null;
}

describe("the stretched line", () => {
  test("[world:month-passes-as-lived] given work, a side job and a master's course carrying on, when the Calendar shows, then its foot says the day runs work, the reading, then the tutoring", async () => {
    // Decision 0012: the line reads the commitments that carry on; the class done act by act is not one, so it is never planned.
    const view = graduateWorking([TEACHER, TUTORING]);
    expect(view.job).toMatchObject({ id: TEACHER, side: TUTORING });
    const { store } = await renderWithView(<Calendar />, view);
    expect(stretchedLine()).toBeNull();
    let added = true;
    act(() => {
      added = store.getState().addToPlan({ activity: CLASS, param: null });
    });
    expect(added).toBe(false);
    expect(stretchedLine()).toBeNull();
    act(() => {
      store.getState().addToPlan({ activity: COURSE, param: null });
    });
    expect(stretchedLine()).toBe("Work, then the reading, then the tutoring. You will be tired.");
    expect(stretchedLine()).not.toMatch(/\d/);
  });

  test("[world:month-passes-as-lived] given work and two month-acts beside it, when the plan is read, then it stretches; with one, or with rest as the second, it does not", () => {
    const view = graduateWorking([TEACHER]);
    // Decision 0012: two commitments that carry on stretch the day; the class and the project done act by act do not.
    expect(stretchedWords(view, [{ activity: COURSE, param: null }, { activity: PORTFOLIO, param: null }])).toBe("Work, then the reading, then open source. You will be tired.");
    expect(stretchedWords(view, [{ activity: CLASS, param: null }, { activity: PROJECT, param: null }])).toBeNull();
    expect(stretchedWords(view, [{ activity: COURSE, param: null }, null])).toBeNull();
    expect(stretchedWords(view, [{ activity: COURSE, param: null }, { activity: REST, param: null }])).toBeNull();
    expect(stretchedWords(view, [{ activity: "activity.family-time", param: null }, { activity: "activity.morning-run", param: null }])).toBeNull();
  });

  test("[world:month-passes-as-lived] given no job, when a side job and two classes are planned, then nothing is said: the stretch is work and two things beside it", () => {
    const view = graduateWorking([TUTORING]);
    expect(view.job.id).toBeNull();
    expect(stretchedWords(view, [{ activity: COURSE, param: null }, { activity: PORTFOLIO, param: null }])).toBeNull();
  });

  test("[world:month-passes-as-lived] given a job and a side job and nothing else planned, when the plan is read, then it does not stretch", () => {
    expect(stretchedWords(graduateWorking([TEACHER, TUTORING]), [null])).toBeNull();
  });

  test("[world:month-passes-as-lived] given every month-act that tires, when the stretched line names it, then it has a short name of its own", () => {
    const tiring = Object.values(content.activity).filter((entry) => (entry.slot === "free" || entry.slot === "side") && isMonthAct(entry.id) && !restores(entry.id));
    expect(tiring.length).toBeGreaterThan(10);
    expect(tiring.filter((entry) => say(`ui.days.short.${entry.id}`) === `ui.days.short.${entry.id}`).map((entry) => entry.id)).toEqual([]);
  });
});
