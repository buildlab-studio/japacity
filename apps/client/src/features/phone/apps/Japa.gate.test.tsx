// The gate on each way, in Japa's way files (docs/rules/route-gates.md, world.md R-WORLD-019): the points against the
// cut-off and the pool, the sponsor and the salary bar, the endorsement and its wait, the agent and the job, the partner
// a way rests on, and the road never shown, each assertion against the phone's own element.
import type { PlayerView, RouteGateView, RouteView } from "@japacity/sim";
import { screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { abroadView, richView } from "../../../shared/testing/fixtures";
import { courted, peopleGame, TOBI } from "../../../shared/testing/person";
import { renderWithView } from "../../../shared/testing/render";
import { formatMoney, formatNumber } from "../../../shared/words/format";
import { inMonths, nameOf, say } from "../../../shared/words/text";
import { Japa } from "./Japa";
import { agoWords } from "./JapaWays";

/** A view whose only route is the engine's own entry for this id, known, with the given gate. */
function withRoute(id: RouteView["id"], gate: RouteGateView | null, base: PlayerView = abroadView()): PlayerView {
  const route = base.routes.find((entry) => entry.id === id);
  if (route === undefined) throw new Error(`No route ${id} in the view.`);
  return { ...base, routes: [{ ...route, state: "known", percent: 30, gate: gate ?? route.gate }] };
}

describe("the gate on each way in Japa", () => {
  test("[R-POINTS-001] given the Canadian route looked into and no profile in the pool (set on the view), then the engine's score shows against the cut-off and the care cut-off", async () => {
    const engine = withRoute("route.canada-points", null).routes[0]!.gate;
    if (engine?.gate !== "points") throw new Error("The Canadian route has no points gate.");
    const gate = { ...engine, poolMonth: null, profileEndsMonth: null, invitedMonth: null };
    await renderWithView(<Japa />, withRoute("route.canada-points", gate));
    expect(document.querySelector('[data-way-file="route.canada-points"] [data-gate="points"]')).not.toBeNull();
    expect(screen.getByText(formatNumber(gate.points))).toBeDefined();
    expect(screen.getByText(say("ui.gate.points.cutoff", { cutoff: formatNumber(gate.cutoff) }))).toBeDefined();
    expect(screen.getByText(say("ui.gate.points.short", { short: formatNumber(gate.cutoff - gate.points) }))).toBeDefined();
    expect(screen.getByText(say("ui.gate.points.care", { cutoff: formatNumber(gate.careCutoff!) }))).toBeDefined();
    expect(screen.getByText(say("ui.gate.points.no-pool"))).toBeDefined();
  });

  test("[R-POINTS-006] given a carer under the general cut-off but at the care cut-off, when the gate shows, then it says she is at the cut-off for care workers, not short", async () => {
    await renderWithView(<Japa />, withRoute("route.canada-points", { gate: "points", points: 480, cutoff: 520, careCutoff: 475, invites: true, poolMonth: 30, profileEndsMonth: 42, invitedMonth: null }));
    expect(screen.getByText(say("ui.gate.points.over-care"))).toBeDefined();
    expect(screen.queryByText(say("ui.gate.points.short", { short: formatNumber(40) }))).toBeNull();
  });

  test("[R-POINTS-006] given the same score without the care to count, when the gate shows, then it is short of the general cut-off", async () => {
    await renderWithView(<Japa />, withRoute("route.canada-points", { gate: "points", points: 480, cutoff: 520, careCutoff: 475, invites: false, poolMonth: 30, profileEndsMonth: 42, invitedMonth: null }));
    expect(screen.getByText(say("ui.gate.points.short", { short: formatNumber(40) }))).toBeDefined();
  });

  test("[R-POINTS-002] given a profile in the pool, then the month it entered and the month it lapses show", async () => {
    const view = withRoute("route.canada-points", { gate: "points", points: 470, cutoff: 520, careCutoff: 475, invites: false, poolMonth: 30, profileEndsMonth: 42, invitedMonth: null });
    await renderWithView(<Japa />, view);
    // Said as months ago and away (R-WORLD-002): in the pool since the end of month 30, lapsing as month 42 ends.
    expect(screen.getByText(say("phone.japa.pool", { since: agoWords(30, view.month), ends: inMonths(42, view.month) }))).toBeDefined();
    expect(document.querySelector('[data-gate="points"]')?.textContent).not.toMatch(/month \d+/i);
  });

  test("[R-SPONSOR-006] given a sponsor paying under the bar, then the screen says it cannot be used", async () => {
    await renderWithView(<Japa />, withRoute("route.uk-skilled", { gate: "sponsor", employer: "tech-firm", salary: 3_900_000, underBar: true }));
    expect(screen.getByText(say("ui.gate.sponsor.who", { employer: say("ui.gate.employer.tech-firm") }))).toBeDefined();
    expect(screen.getByText(say("ui.gate.sponsor.salary", { salary: formatMoney(3_900_000, "GBP") }))).toBeDefined();
    expect(screen.getByText(say("ui.gate.sponsor.under"))).toBeDefined();
    expect(screen.getByText(say("ui.gate.sponsor.under-why"))).toBeDefined();
  });

  test("[R-SPONSOR-002] given no sponsor yet, then the gate says how one is found", async () => {
    await renderWithView(<Japa />, withRoute("route.uk-skilled", null));
    expect(screen.getByText(say("ui.gate.sponsor.none"))).toBeDefined();
  });

  test("[R-ENDORSE-002] given an endorsement refused, then the month and the end of the cooldown show", async () => {
    const view = withRoute("route.uk-talent", { gate: "endorsement", refusedMonth: 30, cooledFromMonth: 42 });
    await renderWithView(<Japa />, view);
    // Said as months ago and away (R-WORLD-002). The refusal is stamped as month 30 ends; asking again is judged while
    // planning, so from 42 months played, the month the header calls 43.
    expect(screen.getByText(say("phone.japa.endorsement.refused", { when: agoWords(30, view.month) }))).toBeDefined();
    expect(screen.getByText(say("phone.japa.endorsement.again", { when: inMonths(42, view.month) }))).toBeDefined();
    expect(document.querySelector('[data-gate="endorsement"]')?.textContent).not.toMatch(/month \d+/i);
  });

  test("[R-CONTRACT-002] given an agent recorded, then the role and the monthly pay show in dirhams", async () => {
    await renderWithView(<Japa />, withRoute("route.gulf-contract", { gate: "contract", employer: "gulf-agent", salary: 220_000, role: "guard" }));
    expect(screen.getByText(say("ui.gate.contract.role", { role: say("ui.gate.role.guard") }))).toBeDefined();
    // The dirham's sign is followed by a non-breaking space, which the text matcher would fold.
    expect(document.body.textContent).toContain(say("ui.gate.contract.salary", { salary: formatMoney(220_000, "AED") }));
  });

  test("[R-ROAD-001] given the road among the routes, then it never shows", async () => {
    const base = richView();
    const view: PlayerView = { ...base, routes: [...base.routes, { ...base.routes[0]!, id: "route.road", state: "applying", gate: { gate: "road", step: "desert", monthsHere: 1 } }] };
    await renderWithView(<Japa />, view);
    expect([...document.querySelectorAll("[data-way-file] h3")].map((heading) => heading.textContent)).toEqual([nameOf("route.uk-masters")]);
    expect(document.querySelector('[data-way-file="route.road"]')).toBeNull();
    expect(document.body.textContent).not.toContain(nameOf("route.road"));
  });

  test("[R-PEOPLE-026] given the partner gate resting on a bond, then the route names who it rests on and how their side stands", async () => {
    const game = peopleGame();
    const bond = courted(game, TOBI);
    await renderWithView(<Japa />, withRoute("route.uk-partner", { gate: "partner", bond, lead: "applying" }, game.view()));
    expect(screen.getByText(say("ui.gate.partner.title"))).toBeDefined();
    expect(screen.getByText(say("ui.gate.bond.with", { name: nameOf(TOBI), stage: say("ui.people.stage.courting").toLowerCase() }))).toBeDefined();
    expect(screen.getByText(say("ui.gate.lead.state", { state: say("ui.route.state.applying").toLowerCase() }))).toBeDefined();
  });

  test("[R-PEOPLE-022] given the dependant gate with no bond, then it says a partner and an agreement are needed", async () => {
    const game = peopleGame();
    await renderWithView(<Japa />, withRoute("route.uk-dependant", { gate: "dependant", bond: null, lead: null }, game.view()));
    expect(screen.getByText(say("ui.gate.dependant.title"))).toBeDefined();
    expect(screen.getByText(say("ui.gate.bond.none"))).toBeDefined();
  });
});
