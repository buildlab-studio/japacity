// The Calendar says when the plan stretches the character (docs/rules/world.md R-WORLD-030): a
// job with a class and a side job, or a job with two month-acts beside it; one line, no figure.
import { content } from "@japacity/content";
import type { Id, PlayerView } from "@japacity/sim";
import { act } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { applyEffects } from "../../../../../packages/sim/src/route/route.journey";
import { newGame } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { say } from "../../shared/words/text";
import { Calendar } from "./Calendar";
import { isMonthAct } from "../../shared/days/days";
import { restores, stretchedWords } from "../../shared/days/stretch";

const TEACHER = "activity.job-teacher" as Id<"activity">;
const TUTORING = "activity.weekend-tutoring" as Id<"activity">;
const COURSE = "activity.learn-tech" as Id<"activity">;
const PORTFOLIO = "activity.build-portfolio" as Id<"activity">;
const REST = "activity.rest" as Id<"activity">;

/** Ada with the jobs named held, through the activity kind's own effect. */
function adaWorking(jobs: Id<"activity">[]): PlayerView {
  const game = newGame("scenario.ada");
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
  test("[R-WORLD-030] given work, a side job and a class planned, when the Calendar shows, then its foot says the day runs work, class, then the tutoring", async () => {
    const view = adaWorking([TEACHER, TUTORING]);
    expect(view.job).toMatchObject({ id: TEACHER, side: TUTORING });
    const { store } = await renderWithView(<Calendar />, view);
    expect(stretchedLine()).toBeNull();
    act(() => {
      store.getState().addToPlan({ activity: COURSE, param: null });
    });
    expect(stretchedLine()).toBe("Work, then class, then the tutoring. You will be tired.");
    expect(stretchedLine()).not.toMatch(/\d/);
  });

  test("[R-WORLD-030] given work and two month-acts beside it, when the plan is read, then it stretches; with one, or with rest as the second, it does not", () => {
    const view = adaWorking([TEACHER]);
    expect(stretchedWords(view, [{ activity: COURSE, param: null }, { activity: PORTFOLIO, param: null }])).toBe("Work, then class, then your project. You will be tired.");
    expect(stretchedWords(view, [{ activity: COURSE, param: null }, null])).toBeNull();
    expect(stretchedWords(view, [{ activity: COURSE, param: null }, { activity: REST, param: null }])).toBeNull();
    expect(stretchedWords(view, [{ activity: "activity.family-time", param: null }, { activity: "activity.morning-run", param: null }])).toBeNull();
  });

  test("[R-WORLD-030] given no job, when a side job and two classes are planned, then nothing is said: the stretch is work and two things beside it", () => {
    const view = adaWorking([TUTORING]);
    expect(view.job.id).toBeNull();
    expect(stretchedWords(view, [{ activity: COURSE, param: null }, { activity: PORTFOLIO, param: null }])).toBeNull();
  });

  test("[R-WORLD-030] given a job and a side job and nothing else planned, when the plan is read, then it does not stretch", () => {
    expect(stretchedWords(adaWorking([TEACHER, TUTORING]), [null])).toBeNull();
  });

  test("[R-WORLD-030] given every month-act that tires, when the stretched line names it, then it has a short name of its own", () => {
    const tiring = Object.values(content.activity).filter((entry) => (entry.slot === "free" || entry.slot === "side") && isMonthAct(entry.id) && !restores(entry.id));
    expect(tiring.length).toBeGreaterThan(10);
    expect(tiring.filter((entry) => say(`ui.days.short.${entry.id}`) === `ui.days.short.${entry.id}`).map((entry) => entry.id)).toEqual([]);
  });
});
