// The points panel in Japa's file for Canada: which cut-off a teacher or a carer meets, the teachers' cut-off while the education
// draw stands, and the funds short of what Canada asks to see (route-gates.md).
import { content } from "@japacity/content";
import type { PlayerView, RouteGateView } from "@japacity/sim";
import { screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { newGame } from "../../../shared/testing/fixtures";
import { renderWithView } from "../../../shared/testing/render";
import { formatMoney, formatNumber } from "../../../shared/words/format";
import { say } from "../../../shared/words/text";
import { Japa } from "./Japa";

type PointsGate = Extract<RouteGateView, { gate: "points" }>;
const CANADA = "route.canada-points";

/** A view whose only route is Canada's points route, known, with this gate. */
function withPoints(base: PlayerView, gate: PointsGate): PlayerView {
  const route = base.routes.find((entry) => entry.id === CANADA);
  if (route === undefined) throw new Error("No Canadian route in the view.");
  return { ...base, routes: [{ ...route, state: "known", percent: 30, gate }] };
}

const gate = (over: Partial<PointsGate>): PointsGate => ({ gate: "points", points: 400, cutoff: 520, careCutoff: 475, educationCutoff: null, fundsShort: 0, invites: false, poolMonth: 30, profileEndsMonth: 42, invitedMonth: null, ...over });

const panel = () => document.querySelector(`[data-way-file="${CANADA}"] [data-gate="points"]`)?.textContent ?? "";

describe("the cut-off met, named", () => {
  test("[route-gates:points-view-carries-invites] [route-gates:pool-draws-invite] given a teacher under the general and the care cut-offs but at the teachers' while the draw stands, when the gate shows, then it names the teachers' cut-off, never the care workers'", async () => {
    const view = newGame("scenario.teacher").view();
    const care = view.qualities.find((quality) => quality.id === "quality.care")?.value ?? 0;
    expect(care).toBeLessThan(content.points["points.canada"]!.careMin);
    await renderWithView(<Japa />, withPoints(view, gate({ points: 400, educationCutoff: 365, invites: true })));
    expect(screen.getByText(say("ui.gate.points.over-education"))).toBeDefined();
    expect(screen.queryByText(say("ui.gate.points.over-care"))).toBeNull();
    expect(panel()).toContain(say("ui.gate.points.education", { cutoff: formatNumber(365) }));
  });

  test("[route-gates:points-view-carries-invites] given a nurse at the care cut-off, when the gate shows, then it names the care workers' cut-off", async () => {
    const view = newGame("scenario.nurse").view();
    await renderWithView(<Japa />, withPoints(view, gate({ points: 480, invites: true })));
    expect(screen.getByText(say("ui.gate.points.over-care"))).toBeDefined();
    expect(screen.queryByText(say("ui.gate.points.over-education"))).toBeNull();
  });

  test("[route-gates:points-view-carries-invites] given no education draw standing, when the gate shows, then no teachers' cut-off is named", async () => {
    await renderWithView(<Japa />, withPoints(newGame("scenario.teacher").view(), gate({})));
    expect(document.querySelector("[data-gate-education]")).toBeNull();
  });
});

describe("the funds Canada asks to see", () => {
  test("[route-gates:canada-funds-checked-at-departure] [route-gates:family-gift-counts-with-deed] given the funds shown short of what Canada asks, when the gate shows, then it says by how much in Canadian dollars", async () => {
    await renderWithView(<Japa />, withPoints(newGame("scenario.teacher").view(), gate({ fundsShort: 250_000 })));
    expect(panel()).toContain(say("ui.gate.points.funds-short", { amount: formatMoney(250_000, "CAD") }));
  });

  test("[route-gates:canada-funds-checked-at-departure] given the funds covered, when the gate shows, then no shortfall is said", async () => {
    await renderWithView(<Japa />, withPoints(newGame("scenario.teacher").view(), gate({ fundsShort: 0 })));
    expect(document.querySelector("[data-gate-funds-short]")).toBeNull();
  });
});
