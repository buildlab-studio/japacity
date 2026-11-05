import { content } from "@japacity/content";
import type { Id } from "@japacity/sim";
import { cleanup } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { newGame } from "../../../shared/testing/fixtures";
import { renderWithView } from "../../../shared/testing/render";
import { formatMoney } from "../../../shared/words/format";
import { lowerFirst, nameOf, say, sayCount } from "../../../shared/words/text";
import { liftWords, tierPay } from "../../../shared/words/profile";
import { requirementSentence } from "../../../shared/words/requirement";
import { Jobs } from "./Jobs";

const text = () => document.querySelector("[data-phone-app=jobs]")?.textContent ?? "";

describe("the trade's next rung in Jobs", () => {
  test("[activity:each-trade-climbs-its-ladder] [wallet:roads-to-the-target] given the nurse on the ward, when Jobs opens, then the next rung of the nurse's ladder shows with its pay and what it still asks, the rung the passbook's ladder road reads", async () => {
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
    for (const need of road?.needs ?? []) expect(rung?.textContent).toContain(lowerFirst(requirementSentence(need, { routes: view.routes })));
    // A quality is said by its band, never its figure (text:bands-not-figures).
    expect(rung?.textContent).not.toMatch(/\b70\b/);
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
    expect(document.querySelector("[data-job-review]")).toBeNull();
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
