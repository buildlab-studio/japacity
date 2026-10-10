import type { PlayerView, RouteGateView, RouteView } from "@japacity/sim";
import { screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { abroadView, richView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { formatMoney, formatNumber } from "../../shared/words/format";
import { nameOf, say } from "../../shared/words/text";
import { RouteView as Routes } from "./RouteView";

/** A view whose only route is the engine's own entry for this id, known, with the given gate. */
function withRoute(id: RouteView["id"], gate: RouteGateView | null, base: PlayerView = abroadView()): PlayerView {
  const route = base.routes.find((entry) => entry.id === id);
  if (route === undefined) throw new Error(`No route ${id} in the view.`);
  return { ...base, routes: [{ ...route, state: "known", percent: 30, gate: gate ?? route.gate }] };
}

describe("the gate on each route", () => {
  test("[R-POINTS-001] given the Canadian route looked into and no profile in the pool (set on the view), then the engine's score shows against the cut-off and the care cut-off", async () => {
    const engine = withRoute("route.canada-points", null).routes[0]!.gate;
    if (engine?.gate !== "points") throw new Error("The Canadian route has no points gate.");
    const gate = { ...engine, poolMonth: null, profileEndsMonth: null, invitedMonth: null };
    const view = withRoute("route.canada-points", gate);
    await renderWithView(<Routes />, view);
    expect(screen.getByText(formatNumber(gate.points))).toBeDefined();
    expect(screen.getByText(say("ui.gate.points.cutoff", { cutoff: formatNumber(gate.cutoff) }))).toBeDefined();
    expect(screen.getByText(say("ui.gate.points.short", { short: formatNumber(gate.cutoff - gate.points) }))).toBeDefined();
    expect(screen.getByText(say("ui.gate.points.care", { cutoff: formatNumber(gate.careCutoff!) }))).toBeDefined();
    expect(screen.getByText(say("ui.gate.points.no-pool"))).toBeDefined();
  });

  test("[R-POINTS-006] given a carer under the general cut-off but at the care cut-off, when the gate shows, then it says she is at the cut-off for care workers, not short", async () => {
    const view = withRoute("route.canada-points", { gate: "points", points: 480, cutoff: 520, careCutoff: 475, invites: true, poolMonth: 30, profileEndsMonth: 42, invitedMonth: null });
    await renderWithView(<Routes />, view);
    expect(screen.getByText(say("ui.gate.points.over-care"))).toBeDefined();
    expect(screen.queryByText(say("ui.gate.points.short", { short: formatNumber(40) }))).toBeNull();
  });

  test("[R-POINTS-006] given the same score without the care to count, when the gate shows, then it is short of the general cut-off", async () => {
    const view = withRoute("route.canada-points", { gate: "points", points: 480, cutoff: 520, careCutoff: 475, invites: false, poolMonth: 30, profileEndsMonth: 42, invitedMonth: null });
    await renderWithView(<Routes />, view);
    expect(screen.getByText(say("ui.gate.points.short", { short: formatNumber(40) }))).toBeDefined();
  });

  test("[R-POINTS-002] given a profile in the pool, then the month it entered and the month it lapses show", async () => {
    const view = withRoute("route.canada-points", { gate: "points", points: 470, cutoff: 520, careCutoff: 475, invites: false, poolMonth: 30, profileEndsMonth: 42, invitedMonth: null });
    await renderWithView(<Routes />, view);
    expect(screen.getByText(say("ui.gate.points.pool", { month: 30, ends: 42, left: 42 - view.month }))).toBeDefined();
  });

  test("[R-SPONSOR-006] given a sponsor paying under the bar, then the screen says it cannot be used", async () => {
    const view = withRoute("route.uk-skilled", { gate: "sponsor", employer: "tech-firm", salary: 3_900_000, underBar: true });
    await renderWithView(<Routes />, view);
    expect(screen.getByText(say("ui.gate.sponsor.who", { employer: say("ui.gate.employer.tech-firm") }))).toBeDefined();
    expect(screen.getByText(say("ui.gate.sponsor.salary", { salary: formatMoney(3_900_000, "GBP") }))).toBeDefined();
    expect(screen.getByText(say("ui.gate.sponsor.under"))).toBeDefined();
    expect(screen.getByText(say("ui.gate.sponsor.under-why"))).toBeDefined();
  });

  test("[R-SPONSOR-002] given no sponsor yet, then the gate says how one is found", async () => {
    await renderWithView(<Routes />, withRoute("route.uk-skilled", null));
    expect(screen.getByText(say("ui.gate.sponsor.none"))).toBeDefined();
  });

  test("[R-ENDORSE-002] given an endorsement refused, then the month and the end of the cooldown show", async () => {
    const view = withRoute("route.uk-talent", { gate: "endorsement", refusedMonth: 30, cooledFromMonth: 42 });
    await renderWithView(<Routes />, view);
    expect(screen.getByText(say("ui.gate.endorsement.refused", { month: 30 }))).toBeDefined();
    // The refusal is stamped as month 30 ends; asking again is judged while planning, so from the month the header calls 43.
    expect(screen.getByText(say("ui.gate.endorsement.again", { month: 43 }))).toBeDefined();
  });

  test("[R-CONTRACT-002] given an agent recorded, then the role and the monthly pay show in dirhams", async () => {
    const view = withRoute("route.gulf-contract", { gate: "contract", employer: "gulf-agent", salary: 220_000, role: "guard" });
    await renderWithView(<Routes />, view);
    expect(screen.getByText(say("ui.gate.contract.role", { role: say("ui.gate.role.guard") }))).toBeDefined();
    // The dirham's sign is followed by a non-breaking space, which the text matcher would fold.
    expect(document.body.textContent).toContain(say("ui.gate.contract.salary", { salary: formatMoney(220_000, "AED") }));
  });

  test("[R-ROAD-001] given the road among the routes, then it never shows", async () => {
    const base = richView();
    const view: PlayerView = { ...base, routes: [...base.routes, { ...base.routes[0]!, id: "route.road", state: "applying", gate: { gate: "road", step: "desert", monthsHere: 1 } }] };
    await renderWithView(<Routes />, view);
    expect(screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual([nameOf("route.uk-masters")]);
  });
});
