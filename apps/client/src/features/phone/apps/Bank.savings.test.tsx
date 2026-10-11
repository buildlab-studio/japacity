// The Bank's "Saved for the move" for the plan's own way (docs/rules/world.md R-WORLD-019):
// a developer whose plan was the UK talent visa read "No figure to save toward yet" all year, while the master's
// plan showed its funds. The figure comes from the plan's route whatever its gate: the funds its decision day asks
// for and the fees still ahead on it, as the engine prices them now. Played on the real engine and content.
import { content } from "@japacity/content";
import type { Effect } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { ARCHETYPES, answersInOrder, presetAnswer } from "../../../shared/frontdoor/archetypes";
import { newGame, recordedGame, viewAfter } from "../../../shared/testing/fixtures";
import { renderWithView } from "../../../shared/testing/render";
import { formatMoney } from "../../../shared/words/format";
import { phoneWords } from "../phone.words";
import { savings } from "../../turn/month.results";
import { Bank, savedFor, savingsOf } from "./Bank";

const TALENT = "route.uk-talent";
const DEVELOPER = ARCHETYPES.find((archetype) => archetype.id === "developer")!;

/** The developer's tile played through the years to the handover, as the front door plays it. */
function developer() {
  const game = newGame("scenario.prologue", "developer-0");
  for (let guard = 0; guard < 40 && game.state.prologue.open; guard += 1) {
    const prologue = game.view().prologue!;
    const answer = presetAnswer(DEVELOPER, prologue) ?? answersInOrder(DEVELOPER, prologue.step, prologue.answers.filter((each) => each.allowed))[0]?.id ?? "";
    game.accept({ type: "prologue/choose", step: prologue.step, answer });
  }
  expect(game.state.prologue.open).toBe(false);
  return game;
}

/** A life with a way as its plan: heard of with what its hearing asks, looked into, leant on. */
function planOn(game: ReturnType<typeof newGame>, route: string) {
  const bars = (content.route[route as keyof typeof content.route]?.hearIf ?? []).flatMap((requirement): Effect[] => (requirement.type === "quality/min" ? [{ type: "quality/add", quality: requirement.quality, amount: requirement.value }] : []));
  viewAfter(game, [...bars, { type: "route/hear", route: route as typeof TALENT, via: "meetup" }]);
  game.accept({ type: "activity/now", activity: "activity.look-into-route", param: route });
  game.accept({ type: "chapter/lean", route: route as typeof TALENT });
  expect(game.view().plan.route).toBe(route);
  return game;
}

/** The developer with the talent visa as his plan. */
function talentPlan() {
  return planOn(developer(), TALENT);
}

/** The pounds the engine prices an act at now. */
function poundsOf(view: ReturnType<ReturnType<typeof newGame>["view"]>, activity: string): number {
  return (view.activities.find((option) => option.id === activity)?.cost ?? []).filter((cost) => cost.currency === "GBP").reduce((sum, cost) => sum + cost.amount, 0);
}

describe("Saved for the move, on the plan's own way", () => {
  test("[R-WORLD-019] given the developer whose plan is the talent visa, when the Bank opens, then the figure is the endorsement's fee and the visa's fee and surcharge, in pounds, against the funds he shows", async () => {
    const view = talentPlan().view();
    const endorsement = poundsOf(view, "activity.apply-endorsement");
    const visa = poundsOf(view, "activity.apply-uk-talent");
    // The fees the content names: the endorsement's, the visa's and five years of the surcharge.
    expect(endorsement).toBe(content.var["var.uk-talent-endorse-fee"]!.start);
    expect(visa).toBe(content.var["var.uk-talent-visa-fee"]!.start + 5 * content.var["var.uk-surcharge-year"]!.start);
    const savings = savingsOf(view);
    expect(savings).toMatchObject({ currency: "GBP", required: endorsement + visa });
    // He holds his naira in cash at the handover: all of it is money to pay the fees with, at the bank's rate.
    expect(savings!.shown).toBeGreaterThan(0);
    expect(savings!.shown).toBe(savedFor(view, "GBP"));
    expect(savedFor(view, "GBP")).toBe(Math.floor(((view.pockets.NGN.bank + view.pockets.NGN.cash) * 100) / view.rates.GBP.official));
    await renderWithView(<Bank />, view);
    const shown = document.querySelector("[data-savings]")?.textContent ?? "";
    expect(shown).toContain(phoneWords("phone.bank.savings.line", { shown: formatMoney(savings!.shown, "GBP"), required: formatMoney(endorsement + visa, "GBP") }));
    expect(document.body.textContent).not.toContain(phoneWords("phone.bank.savings.none"));
  });

  test("[R-WORLD-019] given the endorsement asked for, when the Bank opens, then its fee is no longer ahead and only the visa's remain", () => {
    const game = talentPlan();
    const before = savingsOf(game.view())!;
    viewAfter(game, [{ type: "document/request", document: "document.endorsement" }]);
    const view = game.view();
    expect(view.documents.find((paper) => paper.id === "document.endorsement")?.state).toMatch(/pending|held/);
    expect(savingsOf(view)?.required).toBe(before.required - poundsOf(view, "activity.apply-endorsement"));
  });

  test("[R-WORLD-019] given Ada's master's plan, when the Bank opens, then the figure is still the funds her checklist counts", () => {
    const view = recordedGame("ada-careful", 40).view();
    const route = view.routes.find((each) => each.id === "route.uk-masters")!;
    const funds = route.checklist.find((item) => item.id === "funds");
    expect(funds?.need ?? 0).toBeGreaterThan(0);
    expect(savingsOf(view)).toEqual({ shown: funds?.have, required: funds?.need, currency: "GBP" });
  });

  test("[R-WORLD-019] given a nurse whose plan is care work, when the Bank opens, then the figure is the care visa's fee, in pounds", () => {
    const view = planOn(newGame("scenario.ngozi"), "route.uk-care").view();
    expect(savingsOf(view)).toMatchObject({ currency: "GBP", required: content.var["var.uk-care-visa-fee"]!.start });
  });

  test("[R-WORLD-019] given the Gulf as the plan, whose employer pays and whose content asks no funds, when the Bank opens, then no figure is made up", async () => {
    const view = planOn(newGame("scenario.ngozi"), "route.gulf-contract").view();
    expect(savingsOf(view)).toBeNull();
    await renderWithView(<Bank />, view);
    expect(document.body.textContent).toContain(phoneWords("phone.bank.savings.paid"));
  });

  // Restated 11 Oct 2026 for R-WORLD-019 as amended: the figure shows from the month the plan
  // is set, as the results show it, where it waited for the official page before.
  test("[R-WORLD-019] given a way only heard of as the plan's lean, when the Bank opens, then its figure shows at once, the results' own, and still once the way is looked into", async () => {
    const game = newGame("scenario.ngozi");
    viewAfter(game, [{ type: "route/hear", route: "route.uk-care", via: "meetup" }]);
    const heard = game.view();
    expect(heard.plan.route).toBe("route.uk-care");
    expect(heard.routes.find((route) => route.id === "route.uk-care")?.state).toBe("heard");
    const figure = savingsOf(heard)!;
    expect(savings(heard)).toEqual({ kind: "funds", ...figure });
    await renderWithView(<Bank />, heard);
    // Ngozi already holds the care visa's fee: the line says it is enough, with the figure.
    expect(document.querySelector("[data-savings]")?.textContent).toContain(formatMoney(figure.required, figure.currency));
    expect(document.querySelector("[data-savings-none]")).toBeNull();
    game.accept({ type: "activity/now", activity: "activity.look-into-route", param: "route.uk-care" });
    await renderWithView(<Bank />, game.view());
    expect(document.querySelectorAll("[data-savings]").length).toBeGreaterThan(0);
  });

  test("[R-WORLD-019] given the developer who hears of the talent visa at the meetup in his first month, when the month's results and the Bank are read before the official page, then both say the same figure toward the move", async () => {
    const game = developer();
    game.accept({ type: "activity/now", activity: "activity.meetup", param: null });
    game.endTurn([]);
    const view = game.view();
    expect(view.plan.route).toBe(TALENT);
    expect(view.routes.find((route) => route.id === TALENT)?.state).toBe("heard");
    const shown = savings(view);
    if (shown === null || shown.kind !== "funds") throw new Error("The results show no figure toward the move.");
    await renderWithView(<Bank />, view);
    expect(document.querySelector("[data-savings-none]")).toBeNull();
    expect(document.querySelector("[data-savings]")?.textContent).toContain(phoneWords("phone.bank.savings.line", { shown: formatMoney(shown.shown, shown.currency), required: formatMoney(shown.required, shown.currency) }));
  });

  test("[R-WORLD-019] given the master's only heard of, with nothing to count yet, when the Bank opens, then one line says there is no plan yet, as the results show no figure", async () => {
    const game = newGame("scenario.ada");
    viewAfter(game, [{ type: "route/hear", route: "route.uk-masters", via: "meetup" }]);
    const view = game.view();
    expect(view.plan.route).toBe("route.uk-masters");
    expect(savingsOf(view)).toBeNull();
    await renderWithView(<Bank />, view);
    expect(document.querySelector("[data-savings]")).toBeNull();
    expect(document.querySelector("[data-savings-none]")?.textContent).toBe("No plan yet.");
  });

  test("[R-WORLD-019] given a new life with no way heard of, when the Bank opens, then one line says there is no plan yet", async () => {
    const view = newGame("scenario.ada").view();
    expect(view.plan.route).toBeNull();
    await renderWithView(<Bank />, view);
    expect(document.querySelector("[data-savings-none]")?.textContent).toBe("No plan yet.");
  });
});
