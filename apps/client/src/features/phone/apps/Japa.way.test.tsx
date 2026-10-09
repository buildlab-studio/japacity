// Japa names the way out the nudge reads (docs/rules/world.md R-WORLD-019): a route heard of is a way
// out, so the header never says "No way out yet" beside a nudge to read its official page. And the
// figure the results save toward is broken down here (docs/rules/route.md R-ROUTE-009): the tuition
// still to pay, the living money to show, and beside them the flight.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { toKnown } from "../../../../../../packages/sim/src/route/route.journey";
import { newGame, viewAfter } from "../../../shared/testing/fixtures";
import { renderWithView } from "../../../shared/testing/render";
import { formatMoney } from "../../../shared/words/format";
import { nameOf, say } from "../../../shared/words/text";
import { phoneWords } from "../phone.words";
import { Japa, moveCosts } from "./Japa";

const UK = "route.uk-masters";

describe("the way out in Japa", () => {
  test("[R-WORLD-019] given a route only heard of and no plan, when Japa shows, then its header names that route, not no way out", async () => {
    const view = viewAfter(newGame("scenario.ada"), [{ type: "route/hear", route: UK, via: "test" }]);
    expect(view.japacity.route).toBeNull();
    await renderWithView(<Japa />, view);
    const head = document.querySelector("[data-japa-route]");
    expect(head?.getAttribute("data-japa-route")).toBe(UK);
    expect(head?.textContent).toBe(nameOf(UK));
    expect(document.body.textContent).not.toContain(phoneWords("phone.japa.none"));
  });

  test("[R-WORLD-019] given no route heard of, when Japa shows, then it says there is no way out yet", async () => {
    await renderWithView(<Japa />, newGame("scenario.ada").view());
    expect(document.querySelector("[data-japa-route]")?.textContent).toBe(phoneWords("phone.japa.none"));
  });

  test("[R-WORLD-019] [R-ROUTE-009] given the UK master's looked into, when Japa shows, then the funds to show are broken down into the tuition and the living money, with the flight beside them", async () => {
    const game = newGame("scenario.ada");
    toKnown(game);
    const view = game.view();
    const route = view.routes.find((each) => each.id === UK);
    if (route === undefined) throw new Error("No UK route in the view.");
    const cheapest = Math.min(...(content.route[UK]?.schools ?? []).map((id) => content.school[id]?.tuition ?? 0));
    const costs = moveCosts(route);
    expect(costs.map((cost) => cost.key)).toEqual(["ui.japa.cost.tuition", "ui.japa.cost.living", "ui.japa.cost.funds", "ui.japa.cost.flight"]);
    expect(costs[0]?.amount).toBe(cheapest);
    // The whole is the funds the checklist asks to see now, as the results' savings bar reads it.
    const funds = route.checklist.find((item) => item.need !== null && content.route[UK]?.checklist.find((entry) => entry.id === item.id)?.requirement.type === "route/funds");
    expect(costs[2]?.amount).toBe(funds?.need);
    expect((costs[0]?.amount ?? 0) + (costs[1]?.amount ?? 0)).toBe(funds?.need);
    expect(costs[3]).toEqual({ key: "ui.japa.cost.flight", amount: content.tuning.route.flight.amount, currency: content.tuning.route.flight.currency });
    await renderWithView(<Japa />, view);
    const shown = document.querySelector("[data-move-costs]");
    for (const cost of costs) {
      const row = shown?.querySelector(`[data-cost="${cost.key}"]`);
      expect(row?.textContent).toBe(`${say(cost.key)}${formatMoney(cost.amount, cost.currency)}`);
    }
  });
});
