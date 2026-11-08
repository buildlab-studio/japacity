import { content } from "@japacity/content";
import type { Id } from "@japacity/sim";
import { cleanup, fireEvent } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { newGame } from "../../../shared/testing/fixtures";
import { renderWithView } from "../../../shared/testing/render";
import { formatMoney } from "../../../shared/words/format";
import { nameOf, say, sayCount } from "../../../shared/words/text";
import { liftWords, tierPay } from "../../../shared/words/profile";
import { requirementSentence } from "../../../shared/words/requirement";
import { Jobs } from "./Jobs";

const text = () => document.querySelector("[data-phone-app=jobs]")?.textContent ?? "";

describe("the trade's next rung in Jobs", () => {
  test("[activity:each-trade-climbs-its-ladder] [wallet:roads-to-the-target] [world:one-action-one-sheet] given the nurse on the ward, when Jobs opens, then the next rung of the nurse's ladder shows with its pay and what it still asks as chips, the rung the passbook's ladder road reads", async () => {
    const view = newGame("scenario.nurse").view();
    const road = view.passbook?.roads.find((each) => each.road === "ladder");
    expect(road?.via).toBe("activity.job-senior-nurse");
    await renderWithView(<Jobs />, view);
    const rung = document.querySelector("[data-job-rung]");
    expect(rung?.getAttribute("data-job-rung")).toBe("activity.job-senior-nurse");
    expect(rung?.textContent).toContain(nameOf("activity.job-senior-nurse"));
    const pay = content.activity["activity.job-senior-nurse" as Id<"activity">]?.pay;
    if (pay === undefined || pay === null || typeof pay.amount !== "number") throw new Error("The rung has no written pay.");
    expect(rung?.textContent).toContain(formatMoney(pay.amount, pay.currency));
    // world:one-action-one-sheet: each need a chip, never a sentence: months in the trade as progress, every other need with its cross.
    const needs = road?.needs ?? [];
    expect(needs.length).toBeGreaterThan(0);
    expect(rung?.textContent).not.toContain("Still needs");
    // Months in the trade are the developer's test below; every other need is a chip with its words.
    for (const need of needs.filter((each) => each.type !== "activity/tenure")) {
      const chips = [...(rung?.querySelectorAll(`[data-need='${need.type}'][data-need-state='failed']`) ?? [])].map((chip) => chip.textContent);
      expect(chips).toContain(requirementSentence(need, { routes: view.routes }));
    }
    // A quality is said by its band, never its figure (text:bands-not-figures).
    expect(rung?.textContent).not.toMatch(/\b70\b/);
  });

  test("[world:one-action-one-sheet] [activity:each-trade-climbs-its-ladder] given the developer, whose next rung asks months in the trade and a band of tech, when Jobs opens, then the months are a progress chip with the jobs that count behind a tap, and the tech a chip with its cross", async () => {
    const view = newGame("scenario.developer").view();
    const road = view.passbook?.roads.find((each) => each.road === "ladder");
    const tenure = road?.needs.find((need) => need.type === "activity/tenure");
    if (tenure?.type !== "activity/tenure") throw new Error("The developer's rung asks no months.");
    await renderWithView(<Jobs />, view);
    const rung = document.querySelector("[data-job-rung]")!;
    const months = view.job.id !== null && tenure.activities.includes(view.job.id) ? Math.min(view.job.months, tenure.months) : 0;
    expect(rung.querySelector("[data-need-months]")?.textContent).toBe(`${String(months)} / ${String(tenure.months)} months`);
    expect(rung.querySelector("[data-need-jobs]")).toBeNull();
    const which = rung.querySelector<HTMLButtonElement>("[data-need-which]")!;
    expect(which.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(which);
    expect(which.getAttribute("aria-expanded")).toBe("true");
    expect([...rung.querySelectorAll("[data-need-jobs] li")].map((job) => job.textContent)).toEqual(tenure.activities.map((job) => nameOf(job)));
    const tech = road?.needs.find((need) => need.type === "quality/min");
    if (tech === undefined) throw new Error("The developer's rung asks no tech.");
    const chip = rung.querySelector("[data-need='quality/min'][data-need-state='failed']");
    expect(chip?.textContent).toBe(requirementSentence(tech, { routes: view.routes }));
    expect(chip?.querySelector("[data-mark='failed']")).not.toBeNull();
    // No sentence of needs, and no list of jobs joined by "or".
    expect(rung.textContent).not.toMatch(/Still needs| or /);
  });

  test("[activity:each-trade-climbs-its-ladder] given a rung whose every need is met, when Jobs opens, then it says the board can be asked now, and nothing is still asked", async () => {
    const view = newGame("scenario.nurse").view();
    const book = view.passbook;
    if (book === null) throw new Error("The nurse has no passbook.");
    const roads = book.roads.map((road) => (road.road === "ladder" ? { ...road, state: "open" as const, needs: [] } : road));
    await renderWithView(<Jobs />, { ...view, passbook: { ...book, roads } });
    const rung = document.querySelector("[data-job-rung]");
    expect(rung?.textContent).toContain(say("phone.jobs.rung.open"));
    expect(rung?.querySelector("[data-rung-needs]")).toBeNull();
  });

  test("[activity:each-trade-climbs-its-ladder] [wallet:roads-to-the-target] given the banker, whose months count among the accounting jobs too, when Jobs opens, then the next rung is the bank's own senior bank officer, and the chartered accountant shows under it as the road across with its pay", async () => {
    const view = newGame("scenario.banker").view();
    expect(view.job.id).toBe("activity.job-bank-officer");
    await renderWithView(<Jobs />, view);
    expect(document.querySelector("[data-job-rung]")?.getAttribute("data-job-rung")).toBe("activity.job-bank-senior");
    const across = document.querySelector("[data-job-across]");
    expect(across?.getAttribute("data-job-across")).toBe("activity.job-chartered-accountant");
    expect(across?.textContent).toContain(nameOf("activity.job-chartered-accountant"));
    expect(across?.textContent).toContain(say("phone.jobs.across.line"));
    const pay = content.activity["activity.job-chartered-accountant" as Id<"activity">]?.pay;
    if (pay === undefined || pay === null || typeof pay.amount !== "number") throw new Error("The rung has no written pay.");
    expect(across?.textContent).toContain(formatMoney(pay.amount, pay.currency));
    // The road across stands after the next rung.
    expect(document.querySelector("[data-job-rung]")!.compareDocumentPosition(across!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test("[activity:each-trade-climbs-its-ladder] given the nurse and the developer, whose trades count their own jobs alone, when Jobs opens, then no road across shows", async () => {
    for (const scenario of ["scenario.nurse", "scenario.developer"] as const) {
      await renderWithView(<Jobs />, newGame(scenario).view());
      expect(document.querySelector("[data-job-rung]")).not.toBeNull();
      expect(document.querySelector("[data-job-across]")).toBeNull();
      cleanup();
    }
  });

  test("[activity:each-trade-climbs-its-ladder] given no job held, when Jobs opens, then no rung is shown, since a rung is the next step of a trade held", async () => {
    await renderWithView(<Jobs />, newGame("scenario.graduate").view());
    expect(document.querySelector("[data-job-rung]")).toBeNull();
  });
});

describe("the pay review in Jobs", () => {
  test("[activity:naira-pay-reviewed-yearly] given a naira job with its pay on record, when Jobs opens, then the held job's row says the months to its next review", async () => {
    const game = newGame("scenario.nurse");
    game.endTurn();
    const view = game.view();
    const months = view.job.review;
    if (months === undefined) throw new Error("The nurse's job is not reviewed.");
    expect(months).toBeGreaterThan(1);
    await renderWithView(<Jobs />, view);
    expect(document.querySelector("[data-job-row]")?.textContent).toContain(sayCount("phone.jobs.review", months, { count: months }));
  });

  test("[activity:naira-pay-reviewed-yearly] given the review a month away, when Jobs opens, then the row says it comes next month, never 1 months", async () => {
    const game = newGame("scenario.nurse");
    game.endTurn();
    const view = game.view();
    await renderWithView(<Jobs />, { ...view, job: { ...view.job, review: 1 } });
    const row = document.querySelector("[data-job-row]")?.textContent ?? "";
    expect(row).toContain(say("phone.jobs.review.one"));
    expect(row).not.toMatch(/\b1 months/);
  });

  test("[activity:naira-pay-reviewed-yearly] given a job that is not reviewed, when Jobs opens, then the row names no review", async () => {
    const view = newGame("scenario.nurse").view();
    expect(view.job.review).toBeUndefined();
    await renderWithView(<Jobs />, view);
    // text:show-then-tell: the next review is the row's when chip; a job not reviewed has none, and no words of a review.
    const row = document.querySelector("[data-job-row]");
    expect(row).not.toBeNull();
    expect(row?.querySelector('[data-fact="when"]')).toBeNull();
    expect(row?.textContent).not.toMatch(/Pay review/);
  });
});

describe("a side job to take, in Jobs", () => {
  test("[activity:side-jobs-pay-by-tier] [wallet:roads-to-the-target] given no side job held, when Jobs opens, then the side job the passbook names shows with its pay by level and whether it can be asked for now", async () => {
    const view = newGame("scenario.teacher").view();
    const road = view.passbook?.roads.find((each) => each.road === "side");
    if (road === undefined) throw new Error("The teacher has no side road.");
    expect(view.job.side).toBeNull();
    await renderWithView(<Jobs />, view);
    const side = document.querySelector("[data-job-side-road]");
    expect(side?.getAttribute("data-job-side-road")).toBe(road.via);
    expect(side?.textContent).toContain(nameOf(road.via));
    const pay = tierPay(view, road.via);
    if (pay === null) throw new Error("The side job has no pay.");
    expect(side?.textContent).toContain(say("ui.job.pay", { amount: formatMoney(pay.amount, pay.currency) }));
    const lift = liftWords(view, road.via);
    expect(lift).not.toBeNull();
    expect(side?.textContent).toContain(lift ?? "");
    expect(road.state).toBe("open");
    expect(side?.textContent).toContain(say("phone.jobs.rung.open"));
  });

  test("[activity:side-jobs-pay-by-tier] given a side job held, when Jobs opens, then no other side job is offered beside it", async () => {
    const view = newGame("scenario.teacher").view();
    const held = { ...view, job: { ...view.job, side: "activity.weekend-tutoring" as Id<"activity"> } };
    await renderWithView(<Jobs />, held);
    expect(document.querySelector("[data-job-side-road]")).toBeNull();
    expect(text()).toContain(nameOf("activity.weekend-tutoring"));
  });
});
